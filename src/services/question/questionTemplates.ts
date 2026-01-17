import type { QuestionWithCategory } from './questionService';

export interface QuestionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  ifrsStandard: 'S1' | 'S2';
  template: string;
  variables?: string[];
}

export class QuestionTemplateService {
  /**
   * Render a question template with variables
   */
  renderTemplate(template: string, variables: Record<string, string>): string {
    let rendered = template;

    // Replace variables in format {{variableName}}
    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, variables[key]);
    });

    return rendered;
  }

  /**
   * Convert a question to a conversational format
   */
  formatQuestionForChat(question: QuestionWithCategory): string {
    let formatted = question.text;

    // Add context about IFRS requirement if available
    if (question.requirement) {
      formatted = `${formatted}\n\n(IFRS ${question.ifrsStandard} - ${question.requirement})`;
    }

    // Add options for multiple choice questions
    if (question.type === 'multiple_choice' && question.options) {
      try {
        const options = JSON.parse(question.options);
        if (Array.isArray(options)) {
          formatted += '\n\nOptions:';
          options.forEach((option: string, index: number) => {
            formatted += `\n${index + 1}. ${option}`;
          });
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    return formatted;
  }

  /**
   * Create a follow-up question based on answer
   */
  generateFollowUpQuestion(
    question: QuestionWithCategory,
    answer: string
  ): string | null {
    // Generate contextual follow-up based on answer
    if (question.type === 'yes_no') {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        return `Can you provide more details about how ${question.text.toLowerCase()} is implemented in your organization?`;
      } else {
        return `What challenges have you encountered in implementing ${question.text.toLowerCase()}?`;
      }
    }

    if (question.type === 'text' && answer.length < 50) {
      return `Could you elaborate on that?`;
    }

    return null;
  }

  /**
   * Format question for AI prompt
   */
  formatQuestionForAI(question: QuestionWithCategory): string {
    const categoryContext = this.getCategoryContext(question.category.name);
    
    return `Question Category: ${categoryContext}
IFRS Standard: ${question.ifrsStandard}
Question: ${question.text}
Type: ${question.type}
${question.requirement ? `Requirement: ${question.requirement}` : ''}`;
  }

  /**
   * Get context description for category
   */
  private getCategoryContext(categoryName: string): string {
    const contexts: Record<string, string> = {
      governance: 'Governance structure and oversight of sustainability matters',
      strategy: 'Strategy and business model considerations for sustainability',
      risk: 'Risk management and assessment of sustainability-related risks',
      metrics: 'Metrics, targets, and disclosure requirements',
    };

    return contexts[categoryName] || categoryName;
  }
}
