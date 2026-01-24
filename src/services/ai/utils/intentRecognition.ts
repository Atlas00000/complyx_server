import type { Message } from '../interfaces/AIProvider';

/**
 * Intent Recognition Service
 * Detects user intent and follow-up questions for better conversation flow
 */

export type IntentType =
  | 'start_assessment'
  | 'continue_assessment'
  | 'ask_question'
  | 'request_guidance'
  | 'request_clarification'
  | 'provide_answer'
  | 'search_query'
  | 'general_inquiry'
  | 'unknown';

export interface Intent {
  type: IntentType;
  confidence: number; // 0-1
  entities?: {
    ifrsStandard?: 'S1' | 'S2' | 'general';
    topic?: string;
    phase?: 'quick' | 'detailed' | 'followup';
    questionType?: string;
  };
}

export interface FollowUpQuestion {
  detected: boolean;
  isFollowUp: boolean;
  relatesTo?: string; // Previous message reference
  confidence: number; // 0-1
}

/**
 * Intent Recognition Service
 * Classifies user intent and detects follow-up questions
 */
export class IntentRecognitionService {
  /**
   * Recognize intent from user message
   */
  recognizeIntent(message: string, conversationHistory: Message[] = []): Intent {
    const messageLower = message.toLowerCase().trim();

    // Check for assessment-related intents
    const assessmentIntent = this.detectAssessmentIntent(messageLower);
    if (assessmentIntent) {
      return assessmentIntent;
    }

    // Check for question intent
    const questionIntent = this.detectQuestionIntent(messageLower, conversationHistory);
    if (questionIntent) {
      return questionIntent;
    }

    // Check for guidance intent
    const guidanceIntent = this.detectGuidanceIntent(messageLower);
    if (guidanceIntent) {
      return guidanceIntent;
    }

    // Check for clarification intent
    const clarificationIntent = this.detectClarificationIntent(messageLower);
    if (clarificationIntent) {
      return clarificationIntent;
    }

    // Check for search/query intent
    const searchIntent = this.detectSearchIntent(messageLower);
    if (searchIntent) {
      return searchIntent;
    }

    // Default to general inquiry
    return {
      type: 'general_inquiry',
      confidence: 0.5,
      entities: {
        topic: this.extractTopic(messageLower),
      },
    };
  }

  /**
   * Detect assessment-related intents
   */
  private detectAssessmentIntent(message: string): Intent | null {
    const startKeywords = ['start', 'begin', 'commence', 'initiate'];
    const assessmentKeywords = ['assessment', 'compliance', 'evaluation', 'readiness'];

    const hasStart = startKeywords.some(keyword => message.includes(keyword));
    const hasAssessment = assessmentKeywords.some(keyword => message.includes(keyword));

    if (hasStart && hasAssessment) {
      const ifrsStandard = this.extractIFRSStandard(message);
      
      return {
        type: 'start_assessment',
        confidence: 0.9,
        entities: {
          ifrsStandard,
          phase: this.extractPhase(message),
        },
      };
    }

    // Check for continuation
    const continueKeywords = ['continue', 'next', 'proceed', 'go on'];
    if (continueKeywords.some(keyword => message.includes(keyword)) && hasAssessment) {
      return {
        type: 'continue_assessment',
        confidence: 0.85,
        entities: {
          ifrsStandard: this.extractIFRSStandard(message),
        },
      };
    }

    return null;
  }

  /**
   * Detect question intent
   */
  private detectQuestionIntent(message: string, _conversationHistory: Message[]): Intent | null {
    // Check for question markers
    const questionMarkers = ['?', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'can', 'could', 'should', 'would', 'is', 'are', 'does', 'do'];
    const hasQuestionMarker = questionMarkers.some(marker => message.includes(marker));

    if (hasQuestionMarker || message.endsWith('?')) {
      return {
        type: 'ask_question',
        confidence: 0.8,
        entities: {
          ifrsStandard: this.extractIFRSStandard(message),
          topic: this.extractTopic(message),
          questionType: this.detectQuestionType(message),
        },
      };
    }

    return null;
  }

  /**
   * Detect guidance intent
   */
  private detectGuidanceIntent(message: string): Intent | null {
    const guidanceKeywords = [
      'guidance', 'guide', 'help', 'how to', 'steps', 'process',
      'implement', 'explain', 'understand', 'learn',
    ];

    const hasGuidanceKeyword = guidanceKeywords.some(keyword => message.includes(keyword));

    if (hasGuidanceKeyword) {
      return {
        type: 'request_guidance',
        confidence: 0.85,
        entities: {
          ifrsStandard: this.extractIFRSStandard(message),
          topic: this.extractTopic(message),
        },
      };
    }

    return null;
  }

  /**
   * Detect clarification intent
   */
  private detectClarificationIntent(message: string): Intent | null {
    const clarificationKeywords = [
      'clarify', 'clarification', 'what do you mean', 'i don\'t understand',
      'could you explain', 'can you elaborate', 'more detail',
    ];

    const hasClarificationKeyword = clarificationKeywords.some(keyword => message.includes(keyword));

    if (hasClarificationKeyword) {
      return {
        type: 'request_clarification',
        confidence: 0.9,
        entities: {
          topic: this.extractTopic(message),
        },
      };
    }

    return null;
  }

  /**
   * Detect search/query intent
   */
  private detectSearchIntent(message: string): Intent | null {
    const searchKeywords = [
      'search', 'find', 'look for', 'show me', 'tell me about',
      'information about', 'details about', 'what is', 'what are',
    ];

    const hasSearchKeyword = searchKeywords.some(keyword => message.includes(keyword));

    if (hasSearchKeyword) {
      return {
        type: 'search_query',
        confidence: 0.8,
        entities: {
          ifrsStandard: this.extractIFRSStandard(message),
          topic: this.extractTopic(message),
        },
      };
    }

    return null;
  }

  /**
   * Detect follow-up questions
   */
  detectFollowUpQuestion(
    currentMessage: string,
    conversationHistory: Message[]
  ): FollowUpQuestion {
    if (conversationHistory.length === 0) {
      return {
        detected: false,
        isFollowUp: false,
        confidence: 0,
      };
    }

    const currentMessageLower = currentMessage.toLowerCase();
    
    // Check for follow-up indicators
    const followUpIndicators = [
      'what about', 'how about', 'what if', 'and also',
      'also', 'additionally', 'furthermore', 'moreover',
      'related to that', 'building on that', 'following up',
      'another question', 'one more thing',
    ];

    const hasFollowUpIndicator = followUpIndicators.some(indicator => 
      currentMessageLower.includes(indicator)
    );

    // Check for pronouns that refer to previous messages
    const referentialPronouns = ['this', 'that', 'it', 'they', 'these', 'those'];
    const hasPronoun = referentialPronouns.some(pronoun => 
      currentMessageLower.includes(pronoun)
    );

    // Check if message is very short (likely a follow-up)
    const isShortFollowUp = currentMessageLower.trim().split(/\s+/).length < 5 && 
      (hasPronoun || hasFollowUpIndicator);

    // Get previous assistant message to check relation
    const previousAssistantMessage = conversationHistory
      .filter(msg => msg.role === 'assistant')
      .pop();

    const relatesTo = previousAssistantMessage?.content || undefined;

    // Calculate confidence
    let confidence = 0;
    if (hasFollowUpIndicator) {
      confidence += 0.4;
    }
    if (hasPronoun && previousAssistantMessage) {
      confidence += 0.3;
    }
    if (isShortFollowUp) {
      confidence += 0.2;
    }
    if (previousAssistantMessage) {
      confidence += 0.1;
    }

    return {
      detected: confidence > 0.3,
      isFollowUp: confidence > 0.5,
      relatesTo,
      confidence: Math.min(1, confidence),
    };
  }

  /**
   * Extract IFRS standard from message
   */
  private extractIFRSStandard(message: string): 'S1' | 'S2' | 'general' | undefined {
    if (/s1|s-1|sustainability\s+s1|ifrs\s+s1/i.test(message)) {
      return 'S1';
    }
    if (/s2|s-2|climate\s+s2|ifrs\s+s2/i.test(message)) {
      return 'S2';
    }
    if (/ifrs/i.test(message)) {
      return 'general';
    }
    return undefined;
  }

  /**
   * Extract phase from message
   */
  private extractPhase(message: string): 'quick' | 'detailed' | 'followup' | undefined {
    if (/\bquick\b|\bfast\b|\bbrief\b/i.test(message)) {
      return 'quick';
    }
    if (/\bdetailed\b|\bcomprehensive\b|\bfull\b/i.test(message)) {
      return 'detailed';
    }
    if (/\bfollow.?up\b|\bfollowup\b|\badditional\b/i.test(message)) {
      return 'followup';
    }
    return undefined;
  }

  /**
   * Extract topic from message
   */
  private extractTopic(message: string): string | undefined {
    // Extract key topic keywords
    const topicKeywords = [
      'governance', 'strategy', 'risk', 'metrics', 'targets',
      'sustainability', 'climate', 'emissions', 'disclosures',
      'compliance', 'reporting', 'assessment', 'implementation',
      'accounting', 'financial', 'standards',
    ];

    for (const keyword of topicKeywords) {
      if (message.includes(keyword)) {
        return keyword;
      }
    }

    // Extract first few words if no topic keyword found
    const words = message.split(/\s+/).slice(0, 3);
    if (words.length > 0) {
      return words.join(' ');
    }

    return undefined;
  }

  /**
   * Detect question type
   */
  private detectQuestionType(message: string): string | undefined {
    if (/^what\s+/i.test(message)) {
      return 'what';
    }
    if (/^how\s+/i.test(message)) {
      return 'how';
    }
    if (/^why\s+/i.test(message)) {
      return 'why';
    }
    if (/^when\s+/i.test(message)) {
      return 'when';
    }
    if (/^where\s+/i.test(message)) {
      return 'where';
    }
    if (/^who\s+/i.test(message)) {
      return 'who';
    }
    if (/^which\s+/i.test(message)) {
      return 'which';
    }
    if (/\?(.*yes|no)/i.test(message)) {
      return 'yes_no';
    }
    
    return 'general';
  }

  /**
   * Classify overall conversation intent from multiple messages
   */
  classifyConversationIntent(messages: Message[]): {
    primaryIntent: IntentType;
    confidence: number;
    secondaryIntents: IntentType[];
  } {
    const intents = messages
      .filter(msg => msg.role === 'user')
      .map(msg => this.recognizeIntent(msg.content, messages));

    // Count intent occurrences
    const intentCounts = new Map<IntentType, number>();
    intents.forEach(intent => {
      const count = intentCounts.get(intent.type) || 0;
      intentCounts.set(intent.type, count + 1);
    });

    // Get primary intent (most common)
    let primaryIntent: IntentType = 'unknown';
    let maxCount = 0;

    intentCounts.forEach((count, intent) => {
      if (count > maxCount) {
        maxCount = count;
        primaryIntent = intent;
      }
    });

    // Get secondary intents
    const secondaryIntents = Array.from(intentCounts.entries())
      .filter(([intent, count]) => intent !== primaryIntent && count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([intent]) => intent)
      .slice(0, 2);

    const confidence = intents.length > 0 
      ? Math.max(...intents.map(i => i.confidence))
      : 0.5;

    return {
      primaryIntent,
      confidence,
      secondaryIntents,
    };
  }
}

// Export singleton instance
export const intentRecognitionService = new IntentRecognitionService();

// Export convenience functions
export function recognizeIntent(message: string, conversationHistory?: Message[]): Intent {
  return intentRecognitionService.recognizeIntent(message, conversationHistory || []);
}

export function detectFollowUpQuestion(
  currentMessage: string,
  conversationHistory: Message[]
): FollowUpQuestion {
  return intentRecognitionService.detectFollowUpQuestion(currentMessage, conversationHistory);
}
