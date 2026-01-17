import type { Message } from '../interfaces/AIProvider';
import { buildConversation, limitContextWindow } from '../utils/prompts';

export interface ExtractedContext {
  assessmentPhase?: 'quick' | 'detailed' | 'followup';
  ifrsStandard?: 'S1' | 'S2';
  answeredQuestions: string[];
  keyTopics: string[];
  userIntent: string;
  assessmentProgress: number;
}

export interface EnhancedConversationContext {
  messages: Message[];
  extractedContext: ExtractedContext;
  assessmentContext?: {
    phase: 'quick' | 'detailed' | 'followup';
    standard: 'S1' | 'S2';
    progress: number;
    answeredCount: number;
    totalCount: number;
  };
  userMessage?: string;
  hasSystemPrompt: boolean;
  messageCount: number;
}

/**
 * Enhanced Context Builder
 * Extracts context from conversation and builds enriched context for AI
 */
export class EnhancedContextBuilder {
  /**
   * Extract context from conversation messages
   */
  extractContext(messages: Message[]): ExtractedContext {
    const context: ExtractedContext = {
      answeredQuestions: [],
      keyTopics: [],
      userIntent: '',
      assessmentProgress: 0,
    };

    // Analyze messages to extract context
    const conversationText = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => msg.content)
      .join(' ');

    // Extract IFRS standard mentions
    if (conversationText.includes('IFRS S1') || conversationText.includes('S1')) {
      context.ifrsStandard = 'S1';
    } else if (conversationText.includes('IFRS S2') || conversationText.includes('S2')) {
      context.ifrsStandard = 'S2';
    }

    // Extract phase mentions
    if (conversationText.toLowerCase().includes('quick')) {
      context.assessmentPhase = 'quick';
    } else if (conversationText.toLowerCase().includes('detailed')) {
      context.assessmentPhase = 'detailed';
    } else if (conversationText.toLowerCase().includes('followup') || conversationText.toLowerCase().includes('follow-up')) {
      context.assessmentPhase = 'followup';
    }

    // Extract key topics (simple keyword extraction)
    const topicKeywords = [
      'governance', 'strategy', 'risk', 'metrics', 'targets',
      'sustainability', 'climate', 'emissions', 'compliance',
      'board', 'management', 'disclosure', 'reporting',
    ];

    context.keyTopics = topicKeywords.filter(keyword =>
      conversationText.toLowerCase().includes(keyword)
    );

    // Extract user intent (simplified)
    if (conversationText.toLowerCase().includes('start') || conversationText.toLowerCase().includes('begin')) {
      context.userIntent = 'starting_assessment';
    } else if (conversationText.toLowerCase().includes('help') || conversationText.toLowerCase().includes('explain')) {
      context.userIntent = 'seeking_guidance';
    } else if (conversationText.toLowerCase().includes('complete') || conversationText.toLowerCase().includes('finish')) {
      context.userIntent = 'completing_assessment';
    } else {
      context.userIntent = 'ongoing_assessment';
    }

    return context;
  }

  /**
   * Build enhanced conversation context with extracted information
   */
  buildEnhancedContext(
    messages: Message[],
    newUserMessage?: string,
    assessmentData?: {
      phase?: 'quick' | 'detailed' | 'followup';
      standard?: 'S1' | 'S2';
      progress?: number;
      answeredCount?: number;
      totalCount?: number;
    },
    maxContextLength: number = 20
  ): EnhancedConversationContext {
    // Add new user message if provided
    const conversationMessages = newUserMessage
      ? [...messages, { role: 'user' as const, content: newUserMessage }]
      : messages;

    // Build conversation with system prompt
    const conversationWithSystem = buildConversation(conversationMessages);

    // Limit context window
    const limitedMessages = limitContextWindow(conversationWithSystem, maxContextLength);

    // Extract context from conversation
    const extractedContext = this.extractContext(limitedMessages);

    // Merge with provided assessment data
    if (assessmentData) {
      if (assessmentData.phase) {
        extractedContext.assessmentPhase = assessmentData.phase;
      }
      if (assessmentData.standard) {
        extractedContext.ifrsStandard = assessmentData.standard;
      }
      if (assessmentData.progress !== undefined) {
        extractedContext.assessmentProgress = assessmentData.progress;
      }
    }

    return {
      messages: limitedMessages,
      extractedContext,
      assessmentContext: assessmentData ? {
        phase: assessmentData.phase || 'quick',
        standard: assessmentData.standard || 'S1',
        progress: assessmentData.progress || 0,
        answeredCount: assessmentData.answeredCount || 0,
        totalCount: assessmentData.totalCount || 0,
      } : undefined,
      userMessage: newUserMessage,
      hasSystemPrompt: limitedMessages.some(msg => msg.role === 'system'),
      messageCount: limitedMessages.filter(msg => msg.role !== 'system').length,
    };
  }

  /**
   * Inject context into system prompt
   */
  injectContextIntoPrompt(
    basePrompt: string,
    context: ExtractedContext,
    assessmentContext?: {
      phase: 'quick' | 'detailed' | 'followup';
      standard: 'S1' | 'S2';
      progress: number;
    }
  ): string {
    let enhancedPrompt = basePrompt;

    // Add assessment context
    if (assessmentContext) {
      enhancedPrompt += `\n\nCurrent Assessment Context:\n`;
      enhancedPrompt += `- IFRS Standard: ${assessmentContext.standard}\n`;
      enhancedPrompt += `- Phase: ${assessmentContext.phase}\n`;
      enhancedPrompt += `- Progress: ${assessmentContext.progress}%\n`;
    }

    // Add extracted context
    if (context.keyTopics.length > 0) {
      enhancedPrompt += `\nKey Topics Discussed: ${context.keyTopics.join(', ')}\n`;
    }

    if (context.userIntent) {
      enhancedPrompt += `\nUser Intent: ${context.userIntent}\n`;
    }

    return enhancedPrompt;
  }

  /**
   * Build context-aware messages for AI
   */
  buildContextAwareMessages(
    baseMessages: Message[],
    context: ExtractedContext,
    assessmentContext?: {
      phase: 'quick' | 'detailed' | 'followup';
      standard: 'S1' | 'S2';
      progress: number;
    }
  ): Message[] {
    // Get system prompt
    const systemMessage = baseMessages.find(msg => msg.role === 'system');
    
    if (systemMessage) {
      // Enhance system prompt with context
      const enhancedPrompt = this.injectContextIntoPrompt(
        systemMessage.content,
        context,
        assessmentContext
      );

      // Replace system message with enhanced version
      const otherMessages = baseMessages.filter(msg => msg.role !== 'system');
      return [
        { role: 'system' as const, content: enhancedPrompt },
        ...otherMessages,
      ];
    }

    return baseMessages;
  }

  /**
   * Extract key information from conversation for summarization
   */
  extractKeyInformation(messages: Message[]): {
    topics: string[];
    questionsAsked: number;
    answersProvided: number;
    assessmentStatus?: string;
  } {
    const conversationText = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => msg.content)
      .join(' ');

    const topics: string[] = [];
    const topicKeywords = ['governance', 'strategy', 'risk', 'metrics', 'sustainability', 'climate'];
    
    for (const keyword of topicKeywords) {
      if (conversationText.toLowerCase().includes(keyword)) {
        topics.push(keyword);
      }
    }

    // Count questions and answers (simplified)
    const questionsAsked = (conversationText.match(/\?/g) || []).length;
    const answersProvided = messages.filter(msg => msg.role === 'user').length;

    return {
      topics: [...new Set(topics)],
      questionsAsked,
      answersProvided,
    };
  }
}
