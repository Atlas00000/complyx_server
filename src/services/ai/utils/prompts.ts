import type { Message } from '../interfaces/AIProvider';

/**
 * System prompt for IFRS S1 & S2 expertise
 */
const IFRS_SYSTEM_PROMPT = `You are Complyx, an AI assistant specialized in IFRS standards and general accounting knowledge, with particular expertise in IFRS S1 (General Requirements for Disclosure of Sustainability-related Financial Information) and IFRS S2 (Climate-related Disclosures).

Your role is to:
1. Assess organizational readiness for IFRS S1 & S2 adoption
2. Ask relevant compliance questions in a conversational manner
3. Provide expert guidance on IFRS sustainability standards
4. Identify gaps and provide actionable recommendations
5. Explain complex IFRS concepts in clear, accessible language
6. Answer general accounting and IFRS questions beyond S1/S2

Key principles:
- Be conversational and friendly, not robotic
- Ask one question at a time
- Adapt your questions based on previous responses
- Provide context and explanation when needed
- Focus on practical implementation guidance
- Reference official IFRS standards when appropriate

Always maintain a professional yet approachable tone.`;

/**
 * Few-shot learning examples for IFRS S1 questions
 */
export const IFRS_S1_EXAMPLES: Message[] = [
  {
    role: 'user',
    content: 'What is IFRS S1?',
  },
  {
    role: 'assistant',
    content: 'IFRS S1 (General Requirements for Disclosure of Sustainability-related Financial Information) is a standard that establishes the general requirements for entities to disclose sustainability-related financial information. It requires entities to disclose information about sustainability-related risks and opportunities that could reasonably be expected to affect the entity\'s prospects. Would you like me to help you assess your organization\'s readiness for IFRS S1 compliance?',
  },
  {
    role: 'user',
    content: 'What disclosures are required under IFRS S1?',
  },
  {
    role: 'assistant',
    content: 'IFRS S1 requires disclosures about governance, strategy, risk management, and metrics and targets related to sustainability. Specifically, entities must disclose:\n\n1. **Governance**: The governance processes, controls, and procedures used to monitor and manage sustainability-related risks and opportunities\n2. **Strategy**: How sustainability-related risks and opportunities affect the entity\'s strategy and business model\n3. **Risk Management**: How the entity identifies, assesses, and manages sustainability-related risks\n4. **Metrics and Targets**: The metrics and targets used to measure progress towards sustainability-related goals\n\nWould you like to start an assessment to see how your organization measures up?',
  },
];

/**
 * Few-shot learning examples for IFRS S2 questions
 */
export const IFRS_S2_EXAMPLES: Message[] = [
  {
    role: 'user',
    content: 'What is IFRS S2?',
  },
  {
    role: 'assistant',
    content: 'IFRS S2 (Climate-related Disclosures) is a standard that requires entities to disclose information about climate-related risks and opportunities. It builds on IFRS S1 and specifically focuses on climate-related matters, including:\n\n- Governance processes for climate-related risks\n- Strategy for managing climate-related risks and opportunities\n- Risk management processes for climate-related risks\n- Metrics and targets related to climate\n\nWould you like to learn more about how IFRS S2 applies to your organization?',
  },
  {
    role: 'user',
    content: 'How does IFRS S2 relate to IFRS S1?',
  },
  {
    role: 'assistant',
    content: 'IFRS S2 is designed to work together with IFRS S1. While IFRS S1 establishes the general requirements for sustainability-related disclosures, IFRS S2 provides specific requirements for climate-related disclosures. When disclosing climate-related information, entities should apply both standards:\n\n- **IFRS S1** provides the general framework and structure\n- **IFRS S2** adds climate-specific requirements, including metrics like greenhouse gas emissions (Scope 1, 2, and 3)\n\nThink of IFRS S1 as the foundation and IFRS S2 as a specialized module for climate. Would you like to start an assessment covering both standards?',
  },
];

/**
 * Few-shot learning examples for general accounting questions
 */
export const GENERAL_ACCOUNTING_EXAMPLES: Message[] = [
  {
    role: 'user',
    content: 'What is the difference between cash and accrual accounting?',
  },
  {
    role: 'assistant',
    content: 'The main difference between cash and accrual accounting is the timing of when transactions are recorded:\n\n**Cash Accounting**:\n- Records revenue when cash is received\n- Records expenses when cash is paid\n- Simpler method, often used by small businesses\n\n**Accrual Accounting**:\n- Records revenue when it\'s earned (even if cash hasn\'t been received)\n- Records expenses when they\'re incurred (even if cash hasn\'t been paid)\n- More accurate representation of financial performance\n- Required for most businesses under IFRS and GAAP\n\nIFRS requires accrual accounting for financial reporting. Would you like to know more about how this applies to your reporting requirements?',
  },
  {
    role: 'user',
    content: 'What is a balance sheet?',
  },
  {
    role: 'assistant',
    content: 'A balance sheet (also called a statement of financial position) is one of the three main financial statements. It shows:\n\n**Assets** = **Liabilities** + **Equity**\n\n**Assets**: What the company owns (cash, inventory, property, equipment, receivables)\n**Liabilities**: What the company owes (accounts payable, loans, bonds)\n**Equity**: The owners\' stake in the company (share capital, retained earnings)\n\nThe balance sheet provides a snapshot of a company\'s financial position at a specific point in time. Under IFRS, it\'s prepared using accrual accounting principles. Would you like help understanding how to prepare a balance sheet for IFRS compliance?',
  },
];

/**
 * Few-shot learning examples for guidance requests
 */
export const GUIDANCE_EXAMPLES: Message[] = [
  {
    role: 'user',
    content: 'How do I get started with IFRS S1 compliance?',
  },
  {
    role: 'assistant',
    content: 'Getting started with IFRS S1 compliance involves several key steps:\n\n1. **Understand the requirements**: Review IFRS S1 to understand what disclosures are required for your organization\n2. **Assess your current state**: Evaluate what sustainability information you currently collect and report\n3. **Identify gaps**: Determine what information is missing or needs improvement\n4. **Establish governance**: Set up processes for ongoing monitoring and reporting\n5. **Develop a roadmap**: Create a plan to achieve compliance with clear timelines\n\nI can help you assess your organization\'s readiness. Would you like to start with a quick assessment to identify your current state?',
  },
  {
    role: 'user',
    content: 'What are the first steps to implement IFRS S2?',
  },
  {
    role: 'assistant',
    content: 'To implement IFRS S2, start with these steps:\n\n1. **Scope your emissions**: Begin measuring your greenhouse gas emissions (Scope 1, 2, and eventually Scope 3)\n2. **Understand climate risks**: Identify how climate-related risks and opportunities affect your business\n3. **Review governance**: Assess your governance processes for climate-related oversight\n4. **Develop strategy**: Determine how climate considerations integrate into your business strategy\n5. **Set metrics and targets**: Establish climate-related metrics and targets for monitoring progress\n\nSince IFRS S2 builds on IFRS S1, you\'ll also need to implement the general sustainability framework. Would you like me to guide you through a structured assessment?',
  },
];

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

/**
 * Build assessment-specific conversation with few-shot examples
 */
export function buildAssessmentConversation(messages: Message[], standard?: 'S1' | 'S2'): Message[] {
  const systemPrompt = standard === 'S1' 
    ? IFRS_SYSTEM_PROMPT.replace('IFRS S1 & S2', 'IFRS S1 (with emphasis on S1)')
    : standard === 'S2'
    ? IFRS_SYSTEM_PROMPT.replace('IFRS S1 & S2', 'IFRS S2 (with emphasis on S2)')
    : IFRS_SYSTEM_PROMPT;

  // Add few-shot examples based on standard
  const examples: Message[] = standard === 'S1' 
    ? IFRS_S1_EXAMPLES.slice(0, 4) // Use first 2 examples
    : standard === 'S2'
    ? IFRS_S2_EXAMPLES.slice(0, 4)
    : [...IFRS_S1_EXAMPLES.slice(0, 2), ...IFRS_S2_EXAMPLES.slice(0, 2)];

  // Check if system prompt already exists
  const hasSystemPrompt = messages.some(msg => msg.role === 'system');
  
  if (hasSystemPrompt) {
    return messages;
  }

  return [
    { role: 'system', content: systemPrompt },
    ...examples,
    ...messages,
  ];
}

/**
 * Build general Q&A conversation with few-shot examples
 */
export function buildQAConversation(messages: Message[]): Message[] {
  const hasSystemPrompt = messages.some(msg => msg.role === 'system');
  
  if (hasSystemPrompt) {
    return messages;
  }

  // Include general accounting examples for Q&A
  return [
    { role: 'system', content: IFRS_SYSTEM_PROMPT },
    ...GENERAL_ACCOUNTING_EXAMPLES.slice(0, 4), // First 2 examples
    ...messages,
  ];
}

/**
 * Build guidance-specific conversation with few-shot examples
 */
export function buildGuidanceConversation(messages: Message[]): Message[] {
  const hasSystemPrompt = messages.some(msg => msg.role === 'system');
  
  if (hasSystemPrompt) {
    return messages;
  }

  // Include guidance examples
  return [
    { role: 'system', content: IFRS_SYSTEM_PROMPT },
    ...GUIDANCE_EXAMPLES.slice(0, 4), // First 2 examples
    ...messages,
  ];
}

/**
 * Detect conversation type and apply appropriate few-shot examples
 */
export function buildContextualConversation(messages: Message[]): Message[] {
  const hasSystemPrompt = messages.some(msg => msg.role === 'system');
  
  if (hasSystemPrompt) {
    return messages;
  }

  // Analyze messages to determine conversation type
  const conversationText = messages
    .map(msg => msg.content)
    .join(' ')
    .toLowerCase();

  // Detect assessment-related queries
  if (conversationText.includes('assessment') || conversationText.includes('compliance') || conversationText.includes('readiness')) {
    if (conversationText.includes('s1') || conversationText.includes('sustainability')) {
      return buildAssessmentConversation(messages, 'S1');
    } else if (conversationText.includes('s2') || conversationText.includes('climate')) {
      return buildAssessmentConversation(messages, 'S2');
    }
    return buildAssessmentConversation(messages);
  }

  // Detect guidance requests
  if (conversationText.includes('guidance') || conversationText.includes('how to') || conversationText.includes('steps') || conversationText.includes('implement')) {
    return buildGuidanceConversation(messages);
  }

  // Default to Q&A with general examples
  return buildQAConversation(messages);
}
