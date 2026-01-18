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

  /**
   * Summarize conversation context for long conversations
   */
  async summarizeContext(messages: Message[], maxLength: number = 500): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    // Extract key information
    const keyInfo = this.extractKeyInformation(messages);
    const extractedContext = this.extractContext(messages);

    // Build summary from key information
    let summary = 'Previous conversation summary: ';

    // Add topics
    if (keyInfo.topics.length > 0) {
      summary += `Topics discussed: ${keyInfo.topics.join(', ')}. `;
    }

    // Add IFRS standard
    if (extractedContext.ifrsStandard) {
      summary += `Focus on IFRS ${extractedContext.ifrsStandard}. `;
    }

    // Add assessment phase if applicable
    if (extractedContext.assessmentPhase) {
      summary += `Assessment phase: ${extractedContext.assessmentPhase}. `;
    }

    // Add user intent
    if (extractedContext.userIntent) {
      summary += `User intent: ${extractedContext.userIntent.replace(/_/g, ' ')}. `;
    }

    // Add message count
    summary += `Total messages in conversation: ${messages.length}. `;

    // Add progress if available
    if (extractedContext.assessmentProgress > 0) {
      summary += `Assessment progress: ${extractedContext.assessmentProgress}%. `;
    }

    // Extract key questions and answers (first few)
    const userMessages = messages.filter(msg => msg.role === 'user').slice(0, 3);
    const assistantMessages = messages.filter(msg => msg.role === 'assistant').slice(0, 3);

    if (userMessages.length > 0 || assistantMessages.length > 0) {
      summary += 'Key points: ';
      
      userMessages.forEach((msg, idx) => {
        const shortContent = msg.content.substring(0, 100);
        summary += `Q${idx + 1}: ${shortContent}${shortContent.length < msg.content.length ? '...' : ''}. `;
      });

      assistantMessages.forEach((msg, idx) => {
        const shortContent = msg.content.substring(0, 100);
        summary += `A${idx + 1}: ${shortContent}${shortContent.length < msg.content.length ? '...' : ''}. `;
      });
    }

    // Truncate if too long
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary.trim();
  }

  /**
   * Smart context pruning algorithm
   * Keeps most relevant messages while removing redundant or less important ones
   */
  pruneContext(
    messages: Message[],
    maxMessages: number = 50,
    options: {
      keepSystemMessages?: boolean;
      keepRecentMessages?: number;
      prioritizeUserMessages?: boolean;
    } = {}
  ): Message[] {
    const {
      keepSystemMessages = true,
      keepRecentMessages = 10,
      prioritizeUserMessages = true,
    } = options;

    if (messages.length <= maxMessages) {
      return messages;
    }

    // Separate system messages
    const systemMessages = keepSystemMessages
      ? messages.filter(msg => msg.role === 'system')
      : [];

    const conversationMessages = messages.filter(msg => msg.role !== 'system');

    // Always keep recent messages
    const recentMessages = conversationMessages.slice(-keepRecentMessages);

    // Messages to consider for pruning (older messages)
    const olderMessages = conversationMessages.slice(0, -keepRecentMessages);

    // Prioritize user messages if enabled
    if (prioritizeUserMessages && olderMessages.length > 0) {
      const userMessages = olderMessages.filter(msg => msg.role === 'user');
      const assistantMessages = olderMessages.filter(msg => msg.role === 'assistant');

      // Keep more user messages relative to assistant messages
      const userRatio = 0.6; // 60% user, 40% assistant
      const maxOlderMessages = maxMessages - keepRecentMessages - systemMessages.length;
      const maxUserMessages = Math.floor(maxOlderMessages * userRatio);
      const maxAssistantMessages = maxOlderMessages - maxUserMessages;

      // Select diverse user messages (avoid duplicates)
      const selectedUserMessages = this.selectDiverseMessages(userMessages, maxUserMessages);
      
      // Select diverse assistant messages
      const selectedAssistantMessages = this.selectDiverseMessages(assistantMessages, maxAssistantMessages);

      // Combine and sort by original order
      const selectedOlder = [...selectedUserMessages, ...selectedAssistantMessages]
        .sort((a, b) => {
          const aIndex = olderMessages.indexOf(a);
          const bIndex = olderMessages.indexOf(b);
          return aIndex - bIndex;
        });

      return [...systemMessages, ...selectedOlder, ...recentMessages];
    }

    // Simple truncation if prioritization is disabled
    const messagesToKeep = Math.max(0, maxMessages - keepRecentMessages - systemMessages.length);
    const selectedOlder = olderMessages.slice(-messagesToKeep);

    return [...systemMessages, ...selectedOlder, ...recentMessages];
  }

  /**
   * Select diverse messages to avoid redundancy
   */
  private selectDiverseMessages(messages: Message[], maxCount: number): Message[] {
    if (messages.length <= maxCount) {
      return messages;
    }

    // Simple diversity: select evenly spaced messages
    const step = Math.floor(messages.length / maxCount);
    const selected: Message[] = [];

    for (let i = 0; i < messages.length && selected.length < maxCount; i += step) {
      selected.push(messages[i]);
    }

    // Ensure we have maxCount messages
    if (selected.length < maxCount) {
      const remaining = messages.filter(msg => !selected.includes(msg));
      selected.push(...remaining.slice(0, maxCount - selected.length));
    }

    return selected;
  }

  /**
   * Build pruned and summarized context for AI
   */
  async buildPrunedContext(
    messages: Message[],
    maxMessages: number = 50,
    enableSummarization: boolean = true,
    summaryThreshold: number = 30
  ): Promise<{
    messages: Message[];
    summary?: string;
    originalCount: number;
    prunedCount: number;
  }> {
    const originalCount = messages.length;

    // Summarize old messages if threshold exceeded and summarization enabled
    let summary: string | undefined;
    let messagesToPrune = messages;

    if (enableSummarization && messages.length > summaryThreshold) {
      const systemMessages = messages.filter(msg => msg.role === 'system');
      const conversationMessages = messages.filter(msg => msg.role !== 'system');
      
      // Messages to summarize (older messages)
      const messagesToSummarize = conversationMessages.slice(0, -10); // Keep last 10
      const messagesToKeep = conversationMessages.slice(-10); // Recent messages

      if (messagesToSummarize.length > 0) {
        summary = await this.summarizeContext(messagesToSummarize);
        messagesToPrune = [...systemMessages, ...messagesToKeep];
      }
    }

    // Prune context
    const prunedMessages = this.pruneContext(messagesToPrune, maxMessages);

    // Prepend summary if available
    if (summary) {
      prunedMessages.unshift({
        role: 'system',
        content: summary,
      });
    }

    return {
      messages: prunedMessages,
      summary,
      originalCount,
      prunedCount: prunedMessages.length,
    };
  }
}
