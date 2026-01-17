import type { Message } from '../interfaces/AIProvider';

/**
 * System prompt for IFRS S1 & S2 expertise
 */
const IFRS_SYSTEM_PROMPT = `You are Complyx, an AI assistant specialized in IFRS S1 (General Requirements for Disclosure of Sustainability-related Financial Information) and IFRS S2 (Climate-related Disclosures) compliance assessment.

Your role is to:
1. Assess organizational readiness for IFRS S1 & S2 adoption
2. Ask relevant compliance questions in a conversational manner
3. Provide expert guidance on IFRS sustainability standards
4. Identify gaps and provide actionable recommendations
5. Explain complex IFRS concepts in clear, accessible language

Key principles:
- Be conversational and friendly, not robotic
- Ask one question at a time
- Adapt your questions based on previous responses
- Provide context and explanation when needed
- Focus on practical implementation guidance
- Reference official IFRS standards when appropriate

Always maintain a professional yet approachable tone.`;

/**
 * Build a conversation with system prompt
 */
export function buildConversation(messages: Message[]): Message[] {
  // Check if system prompt already exists
  const hasSystemPrompt = messages.some(msg => msg.role === 'system');
  
  if (!hasSystemPrompt) {
    return [
      { role: 'system', content: IFRS_SYSTEM_PROMPT },
      ...messages,
    ];
  }
  
  return messages;
}

/**
 * Get the system prompt
 */
export function getSystemPrompt(): string {
  return IFRS_SYSTEM_PROMPT;
}

/**
 * Create a context-aware message array
 * Limits to last N messages to manage context window
 */
export function limitContextWindow(messages: Message[], maxMessages: number = 20): Message[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Keep system prompt and last N messages
  const systemMessages = messages.filter(msg => msg.role === 'system');
  const conversationMessages = messages.filter(msg => msg.role !== 'system');
  const recentMessages = conversationMessages.slice(-maxMessages);

  return [...systemMessages, ...recentMessages];
}
