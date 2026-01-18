/**
 * Conversational Assessment Service
 * Provides natural conversation flow implementation (not questionnaire-like)
 * AI asks clarifying questions when answers are unclear
 */

import type { AssessmentContext, AnswerData, QuestionNode, FlowDecision } from './assessmentFlowEngine';
import { AssessmentFlowEngine } from './assessmentFlowEngine';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  questionId?: string;
  answerId?: string;
  timestamp: Date;
}

export interface ClarificationRequest {
  questionId: string;
  reason: 'unclear' | 'incomplete' | 'contradictory' | 'needs-detail';
  clarifyingQuestion: string;
  suggestions?: string[];
}

export interface ConversationState {
  messages: ConversationMessage[];
  currentQuestion?: QuestionNode;
  awaitingAnswer?: {
    questionId: string;
    question: QuestionNode;
    askedAt: Date;
  };
  clarifications: ClarificationRequest[];
  assessmentContext: AssessmentContext;
}

/**
 * Conversational Assessment Service
 * Manages natural conversation flow for assessments
 */
export class ConversationalAssessmentService {
  private flowEngine: AssessmentFlowEngine;
  private conversationStates: Map<string, ConversationState> = new Map();

  constructor(flowEngine?: AssessmentFlowEngine) {
    this.flowEngine = flowEngine || new AssessmentFlowEngine();
  }

  /**
   * Start conversational assessment
   */
  startConversationalAssessment(
    sessionId: string,
    userId: string,
    ifrsStandard: 'S1' | 'S2' | 'both',
    mode: 'quick-scan' | 'standard' | 'deep-dive' | 'continuous-monitoring'
  ): ConversationState {
    // Initialize assessment context
    const assessmentContext = this.flowEngine.startAssessment(
      sessionId,
      userId,
      ifrsStandard,
      mode
    );

    // Create conversation state
    const conversationState: ConversationState = {
      messages: [
        {
          role: 'system',
          content: this.generateWelcomeMessage(ifrsStandard, mode),
          timestamp: new Date(),
        },
      ],
      clarifications: [],
      assessmentContext,
    };

    this.conversationStates.set(sessionId, conversationState);

    return conversationState;
  }

  /**
   * Process user message and generate response
   */
  async processMessage(
    sessionId: string,
    message: string
  ): Promise<{
    response: string;
    question?: QuestionNode;
    clarification?: ClarificationRequest;
    conversationState: ConversationState;
  }> {
    const state = this.conversationStates.get(sessionId);
    if (!state) {
      throw new Error(`No conversation state found for session: ${sessionId}`);
    }

    // Add user message
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    state.messages.push(userMessage);

    // Check if awaiting answer
    if (state.awaitingAnswer) {
      return this.processAnswer(sessionId, message, state);
    }

    // Check if this is a new question request
    if (this.isQuestionRequest(message)) {
      return this.generateNextQuestion(sessionId, state);
    }

    // Otherwise, provide conversational response
    return this.generateConversationalResponse(sessionId, message, state);
  }

  /**
   * Process user answer to a question
   */
  private processAnswer(
    sessionId: string,
    answer: string,
    state: ConversationState
  ): Promise<{
    response: string;
    question?: QuestionNode;
    clarification?: ClarificationRequest;
    conversationState: ConversationState;
  }> {
    if (!state.awaitingAnswer) {
      return this.generateConversationalResponse(sessionId, answer, state);
    }

    const { questionId, question } = state.awaitingAnswer;

    // Validate answer
    const validation = this.validateAnswer(answer, question);
    
    if (!validation.valid) {
      // Request clarification
      const clarification = this.requestClarification(questionId, question, validation.reason);
      state.clarifications.push(clarification);
      
      // Clear awaiting answer
      state.awaitingAnswer = undefined;

      return Promise.resolve({
        response: clarification.clarifyingQuestion,
        clarification,
        conversationState: state,
      });
    }

    // Process valid answer
    const answerData: AnswerData = {
      questionId,
      value: this.parseAnswer(answer, question),
      answeredAt: new Date(),
    };

    // Submit answer to flow engine
    state.assessmentContext = this.flowEngine.submitAnswer(
      state.assessmentContext,
      questionId,
      answerData
    );

    // Add answer message
    const answerMessage: ConversationMessage = {
      role: 'user',
      content: answer,
      questionId,
      answerId: `answer-${Date.now()}`,
      timestamp: new Date(),
    };
    state.messages.push(answerMessage);

    // Clear awaiting answer
    state.awaitingAnswer = undefined;

    // Generate acknowledgment and next question
    const acknowledgment = this.generateAcknowledgment(answerData, question);
    
    // Add acknowledgment message
    const ackMessage: ConversationMessage = {
      role: 'assistant',
      content: acknowledgment,
      timestamp: new Date(),
    };
    state.messages.push(ackMessage);

    // Get next question
    return this.generateNextQuestion(sessionId, state);
  }

  /**
   * Generate next question in conversation flow
   */
  private async generateNextQuestion(
    sessionId: string,
    state: ConversationState
  ): Promise<{
    response: string;
    question?: QuestionNode;
    clarification?: ClarificationRequest;
    conversationState: ConversationState;
  }> {
    // Get next question using flow engine
    const decision = this.flowEngine.getContextAwareNextQuestion(state.assessmentContext);

    if (!decision.nextQuestion) {
      // Assessment complete
      return {
        response: this.generateCompletionMessage(state.assessmentContext),
        conversationState: state,
      };
    }

    const question = decision.nextQuestion;

    // Convert question to conversational format
    const conversationalQuestion = this.convertToConversational(question, state.assessmentContext);

    // Set awaiting answer
    state.awaitingAnswer = {
      questionId: question.id,
      question,
      askedAt: new Date(),
    };

    // Add question message
    const questionMessage: ConversationMessage = {
      role: 'assistant',
      content: conversationalQuestion,
      questionId: question.id,
      timestamp: new Date(),
    };
    state.messages.push(questionMessage);

    return {
      response: conversationalQuestion,
      question,
      conversationState: state,
    };
  }

  /**
   * Generate conversational response (not a question)
   */
  private async generateConversationalResponse(
    sessionId: string,
    message: string,
    state: ConversationState
  ): Promise<{
    response: string;
    question?: QuestionNode;
    clarification?: ClarificationRequest;
    conversationState: ConversationState;
  }> {
    // Generate natural conversational response
    const response = this.generateNaturalResponse(message, state);

    // Add response message
    const responseMessage: ConversationMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    state.messages.push(responseMessage);

    return {
      response,
      conversationState: state,
    };
  }

  /**
   * Convert question to conversational format
   */
  private convertToConversational(question: QuestionNode, context: AssessmentContext): string {
    let conversational = question.question;

    // Make it more conversational
    if (!conversational.endsWith('?') && !conversational.endsWith('.')) {
      conversational += '?';
    }

    // Add context-aware introduction
    const progress = Math.round(context.progress);
    if (progress > 0 && progress < 100) {
      conversational = `Great progress! You're at ${progress}%. Now, ${conversational.toLowerCase()}`;
    }

    // Add format hints for better UX
    if (question.format === 'yes-no') {
      conversational += ' (Yes or No)';
    } else if (question.format === 'multiple-choice' && question.options) {
      conversational += ` (Options: ${question.options.slice(0, 3).join(', ')}${question.options.length > 3 ? '...' : ''})`;
    } else if (question.format === 'scale' && question.scaleRange) {
      conversational += ` (Scale: ${question.scaleRange.min}-${question.scaleRange.max})`;
    }

    return conversational;
  }

  /**
   * Validate answer quality
   */
  private validateAnswer(answer: string, question: QuestionNode): {
    valid: boolean;
    reason?: 'unclear' | 'incomplete' | 'contradictory' | 'needs-detail';
  } {
    const answerLower = answer.toLowerCase().trim();

    // Check if answer is too short
    if (answerLower.length < 3) {
      return {
        valid: false,
        reason: 'incomplete',
      };
    }

    // Check if answer is unclear (e.g., "I don't know", "maybe")
    const unclearPatterns = [
      /i don'?t know/i,
      /i'?m not sure/i,
      /maybe/i,
      /perhaps/i,
      /uncertain/i,
      /unclear/i,
    ];

    for (const pattern of unclearPatterns) {
      if (pattern.test(answerLower)) {
        return {
          valid: false,
          reason: 'unclear',
        };
      }
    }

    // Check format-specific validation
    if (question.format === 'yes-no') {
      const yesNoPattern = /^(yes|no|y|n|true|false)$/i;
      if (!yesNoPattern.test(answerLower)) {
        return {
          valid: false,
          reason: 'unclear',
        };
      }
    }

    if (question.format === 'multiple-choice' && question.options) {
      const isValidOption = question.options.some(opt => 
        answerLower.includes(opt.toLowerCase())
      );
      if (!isValidOption && !answerLower.includes('other') && !answerLower.includes('none')) {
        return {
          valid: false,
          reason: 'unclear',
        };
      }
    }

    if (question.format === 'scale' && question.scaleRange) {
      const num = Number(answerLower);
      if (isNaN(num) || num < question.scaleRange.min || num > question.scaleRange.max) {
        return {
          valid: false,
          reason: 'unclear',
        };
      }
    }

    return {
      valid: true,
    };
  }

  /**
   * Request clarification for unclear answer
   */
  private requestClarification(
    questionId: string,
    question: QuestionNode,
    reason: 'unclear' | 'incomplete' | 'contradictory' | 'needs-detail'
  ): ClarificationRequest {
    let clarifyingQuestion = '';

    switch (reason) {
      case 'unclear':
        clarifyingQuestion = `I'm not sure I understood that. Could you clarify: ${question.question}`;
        break;
      case 'incomplete':
        clarifyingQuestion = `Could you provide a bit more detail about: ${question.question}`;
        break;
      case 'needs-detail':
        clarifyingQuestion = `To help me better understand, could you elaborate on: ${question.question}`;
        break;
      default:
        clarifyingQuestion = `Let me ask that again: ${question.question}`;
    }

    // Add format hints
    if (question.format === 'yes-no') {
      clarifyingQuestion += ' (Please answer Yes or No)';
    } else if (question.format === 'multiple-choice' && question.options) {
      clarifyingQuestion += ` (Please choose from: ${question.options.join(', ')})`;
    }

    const suggestions: string[] = [];
    if (question.format === 'yes-no') {
      suggestions.push('Yes', 'No');
    } else if (question.format === 'multiple-choice' && question.options) {
      suggestions.push(...question.options.slice(0, 3));
    }

    return {
      questionId,
      reason,
      clarifyingQuestion,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Parse answer based on question format
   */
  private parseAnswer(answer: string, question: QuestionNode): string | number | boolean | string[] {
    const answerLower = answer.toLowerCase().trim();

    switch (question.format) {
      case 'yes-no':
        return /^(yes|y|true)$/i.test(answerLower);
      
      case 'multiple-choice':
        if (question.options) {
          for (const option of question.options) {
            if (answerLower.includes(option.toLowerCase())) {
              return option;
            }
          }
        }
        return answer;
      
      case 'scale':
        const num = Number(answerLower);
        if (!isNaN(num) && question.scaleRange) {
          return Math.max(question.scaleRange.min, Math.min(question.scaleRange.max, num));
        }
        return answer;
      
      case 'multi-select':
        if (question.options) {
          const selected: string[] = [];
          for (const option of question.options) {
            if (answerLower.includes(option.toLowerCase())) {
              selected.push(option);
            }
          }
          return selected.length > 0 ? selected : [answer];
        }
        return [answer];
      
      default: // open-ended
        return answer;
    }
  }

  /**
   * Generate welcome message
   */
  private generateWelcomeMessage(
    ifrsStandard: 'S1' | 'S2' | 'both',
    mode: 'quick-scan' | 'standard' | 'deep-dive' | 'continuous-monitoring'
  ): string {
    const standardText = ifrsStandard === 'both' ? 'IFRS S1 & S2' : `IFRS ${ifrsStandard}`;
    const modeText = mode === 'quick-scan' ? 'Quick Scan' : 
                     mode === 'standard' ? 'Standard Assessment' :
                     mode === 'deep-dive' ? 'Deep Dive' : 'Continuous Monitoring';

    return `Welcome to your ${standardText} assessment! We'll be conducting a ${modeText} to help evaluate your organization's compliance readiness. I'll ask you questions in a conversational way, and you can answer naturally. Let's begin!`;
  }

  /**
   * Generate acknowledgment for answer
   */
  private generateAcknowledgment(answer: AnswerData, question: QuestionNode): string {
    // Simple acknowledgment
    const acknowledgments = [
      'Got it, thanks!',
      'Thank you for that information.',
      'I understand, thank you.',
      'Perfect, I have that.',
      'Great, noted!',
    ];

    const randomAck = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
    return randomAck;
  }

  /**
   * Generate completion message
   */
  private generateCompletionMessage(context: AssessmentContext): string {
    const gapsCount = context.gaps.length;
    
    return `Excellent work! You've completed the assessment. I've identified ${gapsCount} area${gapsCount !== 1 ? 's' : ''} that may need attention. Would you like me to provide a detailed summary and recommendations?`;
  }

  /**
   * Check if message is a question request
   */
  private isQuestionRequest(message: string): boolean {
    const questionPatterns = [
      /^next/i,
      /^continue/i,
      /^what'?s next/i,
      /^let'?s continue/i,
      /^ready/i,
    ];

    return questionPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Generate natural conversational response
   */
  private generateNaturalResponse(message: string, state: ConversationState): string {
    const messageLower = message.toLowerCase();

    // Handle common conversational patterns
    if (messageLower.includes('help') || messageLower.includes('explain')) {
      return 'I\'m here to help you complete your assessment. Feel free to ask me any questions about IFRS compliance, or just answer the questions I ask. Would you like to continue with the assessment?';
    }

    if (messageLower.includes('skip') || messageLower.includes('skip this')) {
      return 'I understand you\'d like to skip. Let me know if you\'d like to continue with the next question, or we can discuss this further.';
    }

    if (messageLower.includes('back') || messageLower.includes('previous')) {
      return 'I can help you review previous answers. Would you like to go back and revise a specific answer?';
    }

    // Default conversational response
    return 'I understand. Let\'s continue with the assessment. Would you like to answer the next question, or do you have any questions about what we\'ve covered so far?';
  }

  /**
   * Get conversation state
   */
  getConversationState(sessionId: string): ConversationState | undefined {
    return this.conversationStates.get(sessionId);
  }

  /**
   * Clear conversation state
   */
  clearConversationState(sessionId: string): void {
    this.conversationStates.delete(sessionId);
  }
}
