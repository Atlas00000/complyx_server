import { prisma as _prisma } from '../../../utils/db';
import type { Message } from '../interfaces/AIProvider';

export interface ConversationMemory {
  id: string;
  sessionId: string;
  userId: string;
  messages: Message[];
  contextSummary: string; // Summary of conversation context
  lastUpdated: Date;
  messageCount: number;
}

export interface HierarchicalContext {
  session: {
    id: string;
    userId: string;
    startedAt: Date;
    lastActivity: Date;
    totalMessages: number;
    summary?: string; // Session-level summary
  };
  conversations: Array<{
    id: string;
    startedAt: Date;
    endedAt?: Date;
    messages: Message[];
    summary?: string; // Conversation-level summary
    topic?: string; // Main topic of conversation
    messageCount: number;
  }>;
  currentConversation?: {
    id: string;
    messages: Message[];
    startedAt: Date;
    topic?: string;
  };
}

export interface MemoryConfig {
  maxMessages: number; // Maximum messages to store in memory (expanded from 50 to 100)
  maxContextLength: number; // Maximum context window size (expanded from 20 to 50)
  enableSummarization: boolean; // Whether to summarize old messages
  hierarchicalContext: boolean; // Whether to use hierarchical context structure
  conversationThreshold: number; // Messages per conversation before creating new one (default: 30)
}

/**
 * Conversation Memory Service
 * Manages conversation history and context window for AI interactions
 */
export class ConversationMemoryService {
  private defaultConfig: MemoryConfig = {
    maxMessages: 100, // Expanded from 50 to 100
    maxContextLength: 50, // Expanded from 20 to 50
    enableSummarization: true,
    hierarchicalContext: true,
    conversationThreshold: 30, // Messages per conversation
  };

  /**
   * Save conversation messages to memory
   */
  async saveConversation(
    _sessionId: string,
    _userId: string,
    messages: Message[],
    config?: Partial<MemoryConfig>
  ): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };

    // Limit messages if needed
    this.limitMessages(messages, finalConfig.maxMessages);

    // Create summary if enabled and messages exceed threshold
    if (finalConfig.enableSummarization && messages.length > finalConfig.maxContextLength) {
      await this.summarizeContext(messages.slice(0, -finalConfig.maxContextLength));
    }

    // Store in database (using a simple JSON storage approach)
    // In production, you might want a dedicated conversation_messages table
    try {
      // For now, we'll store in a session or use Redis
      // This is a simplified implementation
      // TODO: Implement proper database storage for conversation history
    } catch (error) {
      console.error('Failed to save conversation memory:', error);
    }
  }

  /**
   * Retrieve conversation memory for a session
   */
  async getConversationMemory(
    _sessionId: string,
    _config?: Partial<MemoryConfig>
  ): Promise<Message[]> {

    try {
      // Retrieve from database
      // For now, return empty array - this would query the database
      // TODO: Implement database retrieval for conversation history
      return [];
    } catch (error) {
      console.error('Failed to retrieve conversation memory:', error);
      return [];
    }
  }

  /**
   * Get conversation context (recent messages + summary)
   */
  async getConversationContext(
    sessionId: string,
    config?: Partial<MemoryConfig>
  ): Promise<{
    messages: Message[];
    summary?: string;
    totalMessageCount: number;
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const messages = await this.getConversationMemory(sessionId, config);

    // Get recent messages within context window
    const recentMessages = this.limitMessages(messages, finalConfig.maxContextLength);

    return {
      messages: recentMessages,
      totalMessageCount: messages.length,
    };
  }

  /**
   * Add a new message to conversation memory
   */
  async addMessage(
    sessionId: string,
    userId: string,
    message: Message,
    config?: Partial<MemoryConfig>
  ): Promise<void> {
    const existingMessages = await this.getConversationMemory(sessionId, config);
    const updatedMessages = [...existingMessages, message];
    await this.saveConversation(sessionId, userId, updatedMessages, config);
  }

  /**
   * Clear conversation memory for a session
   */
  async clearMemory(_sessionId: string): Promise<void> {
    try {
      // Clear from database
      // TODO: Implement database deletion for conversation history
    } catch (error) {
      console.error('Failed to clear conversation memory:', error);
    }
  }

  /**
   * Limit messages to maximum count
   */
  private limitMessages(messages: Message[], maxCount: number): Message[] {
    if (messages.length <= maxCount) {
      return messages;
    }

    // Keep system messages and most recent messages
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const conversationMessages = messages.filter(msg => msg.role !== 'system');
    const recentMessages = conversationMessages.slice(-maxCount);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * Summarize old conversation context
   */
  private async summarizeContext(messages: Message[]): Promise<string> {
    // Simple summarization - in production, this could use AI to summarize
    if (messages.length === 0) {
      return '';
    }

    // Extract key information from messages
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    const summary = `Previous conversation context: ${userMessages.length} user messages, ${assistantMessages.length} assistant responses. ` +
      `Key topics discussed: IFRS compliance assessment.`;

    return summary;
  }

  /**
   * Build hierarchical context structure (session → conversation → message)
   */
  async buildHierarchicalContext(
    sessionId: string,
    userId: string,
    config?: Partial<MemoryConfig>
  ): Promise<HierarchicalContext> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const messages = await this.getConversationMemory(sessionId, config);

    // Group messages into conversations based on time gaps or thresholds
    const conversations = this.groupMessagesIntoConversations(messages, finalConfig.conversationThreshold);

    // Build session-level summary if enabled
    let sessionSummary: string | undefined;
    if (finalConfig.enableSummarization && messages.length > finalConfig.maxContextLength) {
      sessionSummary = await this.summarizeContext(messages.slice(0, -finalConfig.maxContextLength));
    }

    // Get current conversation (last one)
    const currentConversation = conversations.length > 0 
      ? {
          id: conversations[conversations.length - 1].id,
          messages: conversations[conversations.length - 1].messages,
          startedAt: conversations[conversations.length - 1].startedAt,
          topic: conversations[conversations.length - 1].topic,
        }
      : undefined;

    return {
      session: {
        id: sessionId,
        userId,
        startedAt: messages.length > 0 ? this.extractFirstMessageDate(messages) : new Date(),
        lastActivity: new Date(),
        totalMessages: messages.length,
        summary: sessionSummary,
      },
      conversations: conversations.slice(0, -1), // All except current
      currentConversation,
    };
  }

  /**
   * Group messages into conversations based on time gaps or message thresholds
   */
  private groupMessagesIntoConversations(
    messages: Message[],
    threshold: number
  ): Array<{
    id: string;
    startedAt: Date;
    messages: Message[];
    topic?: string;
    messageCount: number;
  }> {
    if (messages.length === 0) {
      return [];
    }

    const conversations: Array<{
      id: string;
      startedAt: Date;
      messages: Message[];
      topic?: string;
      messageCount: number;
    }> = [];

    let currentConversation: Message[] = [];
    let conversationStartIndex = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      currentConversation.push(message);

      // Start new conversation if threshold reached
      if (currentConversation.length >= threshold) {
        conversations.push({
          id: `conv-${conversationStartIndex}-${i}`,
          startedAt: new Date(), // Would be extracted from first message in production
          messages: [...currentConversation],
          topic: this.extractTopic(currentConversation),
          messageCount: currentConversation.length,
        });

        currentConversation = [];
        conversationStartIndex = i + 1;
      }
    }

    // Add remaining messages as current conversation
    if (currentConversation.length > 0) {
      conversations.push({
        id: `conv-${conversationStartIndex}-${messages.length}`,
        startedAt: new Date(),
        messages: currentConversation,
        topic: this.extractTopic(currentConversation),
        messageCount: currentConversation.length,
      });
    }

    return conversations;
  }

  /**
   * Extract topic from messages (simplified)
   */
  private extractTopic(messages: Message[]): string {
    const text = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ')
      .toLowerCase();

    if (text.includes('s1') || text.includes('sustainability')) {
      return 'IFRS S1';
    }
    if (text.includes('s2') || text.includes('climate')) {
      return 'IFRS S2';
    }
    if (text.includes('assessment') || text.includes('compliance')) {
      return 'Compliance Assessment';
    }
    if (text.includes('accounting') || text.includes('financial')) {
      return 'General Accounting';
    }

    return 'General Discussion';
  }

  /**
   * Extract date from first message (placeholder)
   */
  private extractFirstMessageDate(_messages: Message[]): Date {
    return new Date();
  }

  /**
   * Get conversation context with hierarchical structure
   */
  async getHierarchicalContext(
    sessionId: string,
    userId: string,
    config?: Partial<MemoryConfig>
  ): Promise<{
    hierarchical: HierarchicalContext;
    flattened: Message[]; // Flattened messages for AI context
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };

    if (!finalConfig.hierarchicalContext) {
      // Fallback to flat structure
      const messages = await this.getConversationMemory(sessionId, config);
      return {
        hierarchical: {
          session: { id: sessionId, userId, startedAt: new Date(), lastActivity: new Date(), totalMessages: messages.length },
          conversations: [],
        },
        flattened: messages,
      };
    }

    const hierarchical = await this.buildHierarchicalContext(sessionId, userId, config);
    
    // Flatten hierarchical structure for AI context (prioritize current conversation + summaries)
    const flattened: Message[] = [];
    
    // Add session summary if available
    if (hierarchical.session.summary) {
      flattened.push({
        role: 'system',
        content: `[Session Summary] ${hierarchical.session.summary}`,
      });
    }

    // Add summaries from previous conversations
    hierarchical.conversations.forEach(conv => {
      if (conv.summary) {
        flattened.push({
          role: 'system',
          content: `[Previous Conversation: ${conv.topic || 'Unknown'}] ${conv.summary}`,
        });
      }
    });

    // Add current conversation messages
    if (hierarchical.currentConversation) {
      flattened.push(...hierarchical.currentConversation.messages);
    }

    return { hierarchical, flattened };
  }

  /**
   * Get memory statistics for a session
   */
  async getMemoryStats(sessionId: string): Promise<{
    messageCount: number;
    oldestMessage?: Date;
    newestMessage?: Date;
    conversationCount?: number;
  }> {
    const messages = await this.getConversationMemory(sessionId);
    
    // If hierarchical context enabled, count conversations
    const config = { ...this.defaultConfig };
    if (config.hierarchicalContext) {
      const hierarchical = await this.buildHierarchicalContext(sessionId, '', config);
      return {
        messageCount: messages.length,
        conversationCount: hierarchical.conversations.length + (hierarchical.currentConversation ? 1 : 0),
      };
    }
    
    return {
      messageCount: messages.length,
    };
  }

  /**
   * Check if memory needs cleanup (too many messages)
   */
  async needsCleanup(sessionId: string, threshold: number = 100): Promise<boolean> {
    const stats = await this.getMemoryStats(sessionId);
    return stats.messageCount > threshold;
  }

  /**
   * Cleanup old messages, keeping only recent ones
   */
  async cleanupMemory(sessionId: string, keepRecent: number = 20): Promise<void> {
    const messages = await this.getConversationMemory(sessionId);
    
    if (messages.length > keepRecent) {
      messages.filter(msg => msg.role === 'system');
      const conversationMessages = messages.filter(msg => msg.role !== 'system');
      conversationMessages.slice(-keepRecent);
      
      // Save cleaned up messages
      // TODO: Implement proper cleanup and save
    }
  }
}
