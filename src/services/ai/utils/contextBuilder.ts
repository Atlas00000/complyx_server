import type { Message } from '../interfaces/AIProvider';
import { buildConversation, limitContextWindow } from './prompts';
import { CONTEXTUAL_ASSESSMENT_PROMPT_ADDITION } from '../prompts/chatPrompt';

export interface ConversationContext {
  messages: Message[];
  userMessage?: string;
  hasSystemPrompt: boolean;
  messageCount: number;
}

/**
 * Build conversation context from messages.
 * If assessmentContext is provided (e.g. user's latest assessment summary), it is appended to the system prompt.
 */
export function buildConversationContext(
  messages: Message[],
  newUserMessage?: string,
  maxContextLength: number = 20,
  assessmentContext?: string | null
): ConversationContext {
  // Add new user message if provided
  const conversationMessages = newUserMessage
    ? [...messages, { role: 'user' as const, content: newUserMessage }]
    : messages;

  // Build conversation with system prompt
  let conversationWithSystem = buildConversation(conversationMessages);

  // Inject assessment context into system prompt when provided
  if (assessmentContext && assessmentContext.trim()) {
    conversationWithSystem = conversationWithSystem.map((msg) => {
      if (msg.role === 'system') {
        const withContext = `${msg.content}\n\n[Assessment context]\n${assessmentContext.trim()}`;
        return { ...msg, content: `${withContext}\n${CONTEXTUAL_ASSESSMENT_PROMPT_ADDITION}` };
      }
      return msg;
    });
  }

  // Limit context window
  const limitedMessages = limitContextWindow(conversationWithSystem, maxContextLength);

  return {
    messages: limitedMessages,
    userMessage: newUserMessage,
    hasSystemPrompt: limitedMessages.some(msg => msg.role === 'system'),
    messageCount: limitedMessages.filter(msg => msg.role !== 'system').length,
  };
}

/**
 * Extract conversation history from messages
 */
export function extractConversationHistory(messages: Message[]): Message[] {
  // Filter out system messages for history display
  return messages.filter(msg => msg.role !== 'system');
}

/**
 * Get the last N messages from conversation
 */
export function getLastMessages(messages: Message[], count: number = 5): Message[] {
  return messages.slice(-count);
}

/**
 * Check if conversation is too long
 */
export function isConversationTooLong(messages: Message[], maxLength: number = 30): boolean {
  return messages.filter(msg => msg.role !== 'system').length > maxLength;
}
