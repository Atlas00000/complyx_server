import type { Message } from '../interfaces/AIProvider';

/**
 * Prompt Template System
 * Provides dynamic prompt template system with context injection
 */

export interface TemplateVariable {
  key: string;
  value: string | number | boolean;
}

export interface PromptTemplate {
  name: string;
  template: string;
  variables: string[]; // List of variable keys used in template
  description: string;
}

export interface TemplateContext {
  [key: string]: string | number | boolean | undefined;
  conversationHistory?: string;
  userQuery?: string;
  contextDocuments?: string;
  assessmentPhase?: string;
  ifrsStandard?: string;
  userIntent?: string;
  keyTopics?: string[];
  previousAnswers?: string;
}

/**
 * Base template structure for prompt generation
 */
export class PromptTemplateSystem {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default templates
   */
  private initializeDefaultTemplates(): void {
    // System prompt template
    this.registerTemplate({
      name: 'system-prompt',
      template: `You are Complyx, an AI assistant specialized in IFRS standards and general accounting knowledge, with particular expertise in IFRS S1 (Sustainability-related Financial Information Disclosures) and IFRS S2 (Climate-related Disclosures).

{{#if ifrsStandard}}
Currently focusing on: {{ifrsStandard}}
{{/if}}

{{#if contextDocuments}}
Relevant context from knowledge base:
{{contextDocuments}}
{{/if}}

Your role is to:
1. Answer questions based on the provided context and your knowledge of IFRS standards
2. If the context contains IFRS S1 or S2 information and the query relates to sustainability, prioritize that information
3. Provide expert guidance on IFRS standards and accounting principles
4. Explain complex concepts in clear, accessible language
5. Reference official sources when appropriate

Key principles:
- Be conversational and friendly, not robotic
- Provide accurate, fact-based responses
- When referencing IFRS standards, cite the specific standard or section
- If you're unsure about something, say so clearly
- Maintain a professional yet approachable tone`,
      variables: ['ifrsStandard', 'contextDocuments'],
      description: 'Base system prompt with optional IFRS standard and context documents',
    });

    // Assessment-specific prompt template
    this.registerTemplate({
      name: 'assessment-prompt',
      template: `You are conducting an IFRS {{ifrsStandard}} compliance assessment.

{{#if assessmentPhase}}
Current assessment phase: {{assessmentPhase}}
{{/if}}

{{#if previousAnswers}}
Previous answers and context:
{{previousAnswers}}
{{/if}}

{{#if keyTopics}}
Key topics covered: {{keyTopics}}
{{/if}}

Your task is to:
1. Ask relevant compliance questions based on the assessment phase
2. Adapt questions based on previous answers
3. Identify gaps and areas that need attention
4. Provide actionable recommendations
5. Maintain conversational flow`,
      variables: ['ifrsStandard', 'assessmentPhase', 'previousAnswers', 'keyTopics'],
      description: 'Prompt template for assessment-specific conversations',
    });

    // Q&A prompt template
    this.registerTemplate({
      name: 'qa-prompt',
      template: `User Question: {{userQuery}}

{{#if conversationHistory}}
Conversation History:
{{conversationHistory}}
{{/if}}

{{#if contextDocuments}}
Relevant Context from Knowledge Base:
{{contextDocuments}}
{{/if}}

Please provide a comprehensive answer to the user's question based on:
1. The relevant context provided above
2. Your knowledge of IFRS standards and accounting principles
3. The conversation history (if relevant)

Format your response to be:
- Clear and concise
- Well-structured with explanations
- Include relevant citations or references when applicable`,
      variables: ['userQuery', 'conversationHistory', 'contextDocuments'],
      description: 'Prompt template for general Q&A interactions',
    });

    // Guidance-specific prompt template
    this.registerTemplate({
      name: 'guidance-prompt',
      template: `You are providing guidance on IFRS standards and accounting practices.

{{#if userQuery}}
User's question or request: {{userQuery}}
{{/if}}

{{#if userIntent}}
User intent: {{userIntent}}
{{/if}}

{{#if contextDocuments}}
Relevant guidance documents and standards:
{{contextDocuments}}
{{/if}}

Provide practical, actionable guidance that:
1. Addresses the specific question or request
2. References relevant IFRS standards or regulations
3. Includes step-by-step recommendations when applicable
4. Considers industry best practices
5. Is tailored to the user's context`,
      variables: ['userQuery', 'userIntent', 'contextDocuments'],
      description: 'Prompt template for providing guidance and recommendations',
    });
  }

  /**
   * Register a new template
   */
  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.name, template);
  }

  /**
   * Get a template by name
   */
  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }

  /**
   * Render a template with context variables
   */
  renderTemplate(templateName: string, context: TemplateContext): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    let rendered = template.template;

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = this.renderConditionals(rendered, context);

    // Replace variables {{variable}}
    rendered = this.replaceVariables(rendered, context);

    return rendered;
  }

  /**
   * Render conditional blocks ({{#if variable}}...{{/if}})
   */
  private renderConditionals(template: string, context: TemplateContext): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (match, variable, content) => {
      const value = context[variable];
      if (value && value !== '' && value !== 0 && value !== false) {
        return content;
      }
      return '';
    });
  }

  /**
   * Replace template variables with context values
   */
  private replaceVariables(template: string, context: TemplateContext): string {
    const variableRegex = /\{\{(\w+)\}\}/g;
    
    return template.replace(variableRegex, (match, variable) => {
      const value = context[variable];
      
      // Handle array values (e.g., keyTopics)
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      
      // Handle undefined/null values
      if (value === undefined || value === null) {
        return '';
      }
      
      return String(value);
    });
  }

  /**
   * Build a system prompt with context injection
   */
  buildSystemPrompt(context: TemplateContext = {}): string {
    return this.renderTemplate('system-prompt', context);
  }

  /**
   * Build an assessment prompt with context
   */
  buildAssessmentPrompt(context: TemplateContext): string {
    return this.renderTemplate('assessment-prompt', context);
  }

  /**
   * Build a Q&A prompt with context
   */
  buildQAPrompt(context: TemplateContext): string {
    return this.renderTemplate('qa-prompt', context);
  }

  /**
   * Build a guidance prompt with context
   */
  buildGuidancePrompt(context: TemplateContext): string {
    return this.renderTemplate('guidance-prompt', context);
  }

  /**
   * Build a message array with injected context
   */
  buildMessagesWithContext(
    templateName: string,
    context: TemplateContext,
    conversationMessages: Message[] = []
  ): Message[] {
    const systemPrompt = this.renderTemplate(templateName, context);
    
    return [
      { role: 'system', content: systemPrompt },
      ...conversationMessages,
    ];
  }

  /**
   * Extract context from messages for template rendering
   */
  extractContextFromMessages(messages: Message[]): TemplateContext {
    const context: TemplateContext = {};
    
    // Extract conversation history
    const conversationText = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    if (conversationText) {
      context.conversationHistory = conversationText;
    }
    
    // Extract user query from last message
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    if (lastUserMessage) {
      context.userQuery = lastUserMessage.content;
    }
    
    // Extract IFRS standard mentions
    const conversationLower = conversationText.toLowerCase();
    if (conversationLower.includes('ifrs s1') || conversationLower.includes(' s1 ')) {
      context.ifrsStandard = 'IFRS S1';
    } else if (conversationLower.includes('ifrs s2') || conversationLower.includes(' s2 ')) {
      context.ifrsStandard = 'IFRS S2';
    }
    
    return context;
  }
}

// Export singleton instance
export const promptTemplateSystem = new PromptTemplateSystem();

// Export convenience functions
export function buildSystemPrompt(context?: TemplateContext): string {
  return promptTemplateSystem.buildSystemPrompt(context);
}

export function buildAssessmentPrompt(context: TemplateContext): string {
  return promptTemplateSystem.buildAssessmentPrompt(context);
}

export function buildQAPrompt(context: TemplateContext): string {
  return promptTemplateSystem.buildQAPrompt(context);
}

export function buildGuidancePrompt(context: TemplateContext): string {
  return promptTemplateSystem.buildGuidancePrompt(context);
}
