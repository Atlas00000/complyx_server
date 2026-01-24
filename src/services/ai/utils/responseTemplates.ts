import type { Message } from '../interfaces/AIProvider';

/**
 * Response Templates for Common Scenarios
 * Provides pre-built response templates for common AI interaction scenarios
 */

export interface ResponseTemplate {
  id: string;
  name: string;
  template: string;
  variables?: string[];
  description: string;
}

export interface TemplateContext {
  [key: string]: string | number | boolean | undefined;
  userName?: string;
  organizationName?: string;
  ifrsStandard?: string;
  assessmentPhase?: string;
  progress?: number;
  errorMessage?: string;
  question?: string;
  topic?: string;
}

/**
 * Response Template System
 * Manages response templates for common scenarios and edge cases
 */
export class ResponseTemplateSystem {
  private templates: Map<string, ResponseTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Initialize default response templates
   */
  private initializeTemplates(): void {
    // Welcome/Introduction Template
    this.registerTemplate({
      id: 'welcome',
      name: 'Welcome Message',
      template: `Hello! I'm Complyx, your AI assistant for IFRS standards and general accounting knowledge, with particular expertise in IFRS S1 & S2 sustainability disclosures.

{{#if userName}}
Nice to meet you, {{userName}}!
{{/if}}

How can I assist you today? I can help you with:
- IFRS S1 & S2 compliance assessment
- General IFRS and accounting questions
- Implementation guidance and best practices
- Understanding complex accounting concepts`,
      variables: ['userName'],
      description: 'Welcome message for new conversations',
    });

    // Assessment Start Template
    this.registerTemplate({
      id: 'assessment-start',
      name: 'Assessment Start',
      template: `Great! Let's start your IFRS {{ifrsStandard}} compliance assessment.

{{#if organizationName}}
I see we're working with {{organizationName}}.
{{/if}}

This assessment will help us understand your organization's readiness for IFRS {{ifrsStandard}} compliance. I'll ask you a series of questions covering:
- Governance processes
- Strategy and business model
- Risk management
- Metrics and targets

Are you ready to begin?`,
      variables: ['ifrsStandard', 'organizationName'],
      description: 'Template for starting an assessment',
    });

    // Question Prompt Template
    this.registerTemplate({
      id: 'question-prompt',
      name: 'Question Prompt',
      template: `{{#if topic}}
Regarding {{topic}}:
{{/if}}

{{question}}

{{#if assessmentPhase}}
({{assessmentPhase}} assessment phase - Progress: {{progress}}%)
{{/if}}`,
      variables: ['topic', 'question', 'assessmentPhase', 'progress'],
      description: 'Template for asking assessment questions',
    });

    // Clarification Request Template
    this.registerTemplate({
      id: 'clarification',
      name: 'Clarification Request',
      template: `I'd like to make sure I understand your response correctly.

{{#if question}}
You mentioned: {{question}}
{{/if}}

Could you please clarify:
- {{topic}}

This will help me provide you with more accurate guidance.`,
      variables: ['question', 'topic'],
      description: 'Template for requesting clarification',
    });

    // Progress Update Template
    this.registerTemplate({
      id: 'progress-update',
      name: 'Progress Update',
      template: `Excellent progress! You've completed {{progress}}% of the assessment.

{{#if assessmentPhase}}
Current phase: {{assessmentPhase}}
{{/if}}

{{#if ifrsStandard}}
Focus: IFRS {{ifrsStandard}}
{{/if}}

Keep up the great work! We're making good progress.`,
      variables: ['progress', 'assessmentPhase', 'ifrsStandard'],
      description: 'Template for progress updates',
    });

    // Summary/Conclusion Template
    this.registerTemplate({
      id: 'summary',
      name: 'Assessment Summary',
      template: `Thank you for completing the assessment!

{{#if ifrsStandard}}
Based on your responses, here's a summary for IFRS {{ifrsStandard}}:
{{/if}}

**Key Findings:**
- {{findings}}

**Next Steps:**
- {{nextSteps}}

Would you like to review any specific area in more detail?`,
      variables: ['ifrsStandard', 'findings', 'nextSteps'],
      description: 'Template for assessment summaries',
    });

    // Error/Unclear Response Template
    this.registerTemplate({
      id: 'error-unclear',
      name: 'Unclear Response',
      template: `I'm having trouble understanding your response.

{{#if errorMessage}}
Issue: {{errorMessage}}
{{/if}}

Could you please:
- Rephrase your answer, or
- Provide more specific details, or
- Let me know if you'd like me to clarify the question

I'm here to help!`,
      variables: ['errorMessage'],
      description: 'Template for handling unclear responses',
    });

    // Knowledge Gap Template
    this.registerTemplate({
      id: 'knowledge-gap',
      name: 'Knowledge Gap Response',
      template: `I don't have specific information about that topic in my current knowledge base.

{{#if topic}}
Regarding {{topic}}:
{{/if}}

However, I can:
- Help you find relevant IFRS standards
- Guide you to official resources
- Answer related questions I do have information about

Would you like to try rephrasing your question, or explore a related topic?`,
      variables: ['topic'],
      description: 'Template for handling knowledge gaps',
    });

    // General Guidance Template
    this.registerTemplate({
      id: 'guidance',
      name: 'Guidance Response',
      template: `Here's some guidance on {{topic}}:

{{#if ifrsStandard}}
Per IFRS {{ifrsStandard}}:
{{/if}}

**Overview:**
{{overview}}

**Key Considerations:**
- {{considerations}}

**Best Practices:**
- {{bestPractices}}

Would you like me to elaborate on any of these points?`,
      variables: ['topic', 'ifrsStandard', 'overview', 'considerations', 'bestPractices'],
      description: 'Template for providing guidance',
    });

    // Completion/Acknowledgment Template
    this.registerTemplate({
      id: 'acknowledgment',
      name: 'Acknowledgment',
      template: `Thank you for that information!

{{#if nextAction}}
{{nextAction}}
{{/if}}

{{#if assessmentPhase}}
Continuing with the {{assessmentPhase}} assessment...
{{/if}}`,
      variables: ['nextAction', 'assessmentPhase'],
      description: 'Template for acknowledging responses',
    });
  }

  /**
   * Register a new template
   */
  registerTemplate(template: ResponseTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): ResponseTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Render a template with context
   */
  renderTemplate(templateId: string, context: TemplateContext = {}): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template "${templateId}" not found`);
    }

    let rendered = template.template;

    // Handle conditional blocks {{#if variable}}...{{/if}}
    rendered = this.renderConditionals(rendered, context);

    // Replace variables {{variable}}
    rendered = this.replaceVariables(rendered, context);

    return rendered;
  }

  /**
   * Render conditional blocks
   */
  private renderConditionals(template: string, context: TemplateContext): string {
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    
    return template.replace(conditionalRegex, (_match, variable, content) => {
      const value = context[variable];
      if (value && value !== '' && value !== 0 && value !== true) {
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
    
    return template.replace(variableRegex, (_match, variable) => {
      const value = context[variable];
      
      if (value === undefined || value === null) {
        return '';
      }
      
      return String(value);
    });
  }

  /**
   * Get fallback response for edge cases
   */
  getFallbackResponse(scenario: 'error' | 'unclear' | 'timeout' | 'unknown'): string {
    const fallbacks: Record<string, string> = {
      error: 'I apologize, but I encountered an error processing your request. Could you please try again, or rephrase your question?',
      unclear: 'I\'m not sure I understand. Could you please rephrase your question or provide more details?',
      timeout: 'I apologize for the delay. It seems the request is taking longer than expected. Would you like to try again?',
      unknown: 'I\'m not sure how to help with that specific question. Could you try rephrasing it, or ask about IFRS standards, accounting principles, or compliance assessment?',
    };

    return fallbacks[scenario] || fallbacks.unknown;
  }

  /**
   * Determine appropriate template based on context
   */
  determineTemplate(
    context: {
      conversationStage?: 'start' | 'ongoing' | 'end';
      userIntent?: string;
      hasError?: boolean;
      needsClarification?: boolean;
    }
  ): string {
    const { conversationStage, userIntent, hasError, needsClarification } = context;

    // Handle errors first
    if (hasError) {
      return 'error-unclear';
    }

    // Handle clarification needs
    if (needsClarification) {
      return 'clarification';
    }

    // Handle conversation stages
    if (conversationStage === 'start') {
      return userIntent === 'start_assessment' ? 'assessment-start' : 'welcome';
    }

    if (conversationStage === 'end') {
      return 'summary';
    }

    // Default ongoing template
    return 'question-prompt';
  }

  /**
   * Build a response message using templates
   */
  buildResponseMessage(
    templateId: string,
    context: TemplateContext = {}
  ): Message {
    const content = this.renderTemplate(templateId, context);
    return {
      role: 'assistant',
      content,
    };
  }
}

// Export singleton instance
export const responseTemplateSystem = new ResponseTemplateSystem();

// Export convenience functions
export function renderTemplate(templateId: string, context?: TemplateContext): string {
  return responseTemplateSystem.renderTemplate(templateId, context);
}

export function getFallbackResponse(scenario: 'error' | 'unclear' | 'timeout' | 'unknown'): string {
  return responseTemplateSystem.getFallbackResponse(scenario);
}

export function buildResponseMessage(templateId: string, context?: TemplateContext): Message {
  return responseTemplateSystem.buildResponseMessage(templateId, context);
}
