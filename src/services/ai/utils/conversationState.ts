import type { Message } from '../interfaces/AIProvider';
import { recognizeIntent, detectFollowUpQuestion, type Intent, type FollowUpQuestion } from './intentRecognition';

/**
 * Conversation State Tracking Service
 * Tracks conversation state and enhances context-aware response generation
 */

export interface ConversationState {
  sessionId: string;
  userId: string;
  currentIntent: Intent;
  conversationPhase: 'initiation' | 'exploration' | 'assessment' | 'guidance' | 'completion' | 'unknown';
  assessmentContext?: {
    standard: 'S1' | 'S2' | 'general';
    phase: 'quick' | 'detailed' | 'followup';
    progress: number; // 0-100
    questionsAnswered: number;
    totalQuestions?: number;
  };
  keyTopics: string[];
  followUpHistory: FollowUpQuestion[];
  lastUpdated: Date;
  messageCount: number;
}

export interface StateTransition {
  from: ConversationState['conversationPhase'];
  to: ConversationState['conversationPhase'];
  reason: string;
  confidence: number;
}

/**
 * Conversation State Service
 * Manages conversation state and context-aware response generation
 */
export class ConversationStateService {
  private states: Map<string, ConversationState> = new Map();

  /**
   * Get or create conversation state
   */
  getState(sessionId: string, userId: string): ConversationState {
    const existingState = this.states.get(sessionId);
    if (existingState) {
      return existingState;
    }

    // Create new state
    const newState: ConversationState = {
      sessionId,
      userId,
      currentIntent: {
        type: 'unknown',
        confidence: 0,
      },
      conversationPhase: 'initiation',
      keyTopics: [],
      followUpHistory: [],
      lastUpdated: new Date(),
      messageCount: 0,
    };

    this.states.set(sessionId, newState);
    return newState;
  }

  /**
   * Update conversation state based on new message
   */
  updateState(
    sessionId: string,
    userId: string,
    message: string,
    conversationHistory: Message[]
  ): ConversationState {
    const state = this.getState(sessionId, userId);

    // Recognize intent
    const intent = recognizeIntent(message, conversationHistory);

    // Detect follow-up question
    const followUp = detectFollowUpQuestion(message, conversationHistory);

    // Update state
    state.currentIntent = intent;
    state.messageCount += 1;
    state.lastUpdated = new Date();

    // Update follow-up history
    if (followUp.detected) {
      state.followUpHistory.push(followUp);
      // Keep only last 5 follow-ups
      if (state.followUpHistory.length > 5) {
        state.followUpHistory.shift();
      }
    }

    // Update conversation phase
    const newPhase = this.determinePhase(intent, state, conversationHistory);
    if (newPhase !== state.conversationPhase) {
      state.conversationPhase = newPhase;
    }

    // Update key topics
    if (intent.entities?.topic) {
      const topic = intent.entities.topic;
      if (!state.keyTopics.includes(topic)) {
        state.keyTopics.push(topic);
        // Keep only last 10 topics
        if (state.keyTopics.length > 10) {
          state.keyTopics.shift();
        }
      }
    }

    // Update assessment context if applicable
    if (intent.entities?.ifrsStandard || intent.type === 'start_assessment' || intent.type === 'continue_assessment') {
      state.assessmentContext = {
        standard: intent.entities?.ifrsStandard || state.assessmentContext?.standard || 'general',
        phase: intent.entities?.phase || state.assessmentContext?.phase || 'quick',
        progress: state.assessmentContext?.progress || 0,
        questionsAnswered: state.assessmentContext?.questionsAnswered || 0,
        totalQuestions: state.assessmentContext?.totalQuestions,
      };
    }

    // Update progress if in assessment
    if (state.assessmentContext && intent.type === 'provide_answer') {
      state.assessmentContext.questionsAnswered += 1;
      if (state.assessmentContext.totalQuestions) {
        state.assessmentContext.progress = Math.min(
          100,
          Math.round(
            (state.assessmentContext.questionsAnswered / state.assessmentContext.totalQuestions) * 100
          )
        );
      }
    }

    return state;
  }

  /**
   * Determine conversation phase based on intent and state
   */
  private determinePhase(
    intent: Intent,
    currentState: ConversationState,
    conversationHistory: Message[]
  ): ConversationState['conversationPhase'] {
    // Check for assessment intents
    if (intent.type === 'start_assessment' || intent.type === 'continue_assessment') {
      return 'assessment';
    }

    // Check for guidance requests
    if (intent.type === 'request_guidance') {
      return 'guidance';
    }

    // Check for completion indicators
    if (currentState.assessmentContext) {
      if (currentState.assessmentContext.progress >= 100) {
        return 'completion';
      }
    }

    // Check for exploration (multiple questions)
    if (intent.type === 'ask_question' || intent.type === 'search_query') {
      if (conversationHistory.length > 5) {
        return 'exploration';
      }
      return currentState.conversationPhase === 'initiation' ? 'exploration' : currentState.conversationPhase;
    }

    // Default based on current state
    return currentState.conversationPhase || 'unknown';
  }

  /**
   * Get context for response generation
   */
  getContextForResponse(sessionId: string, userId: string): {
    state: ConversationState;
    contextHints: string[];
  } {
    const state = this.getState(sessionId, userId);
    const contextHints: string[] = [];

    // Add phase context
    contextHints.push(`Conversation phase: ${state.conversationPhase}`);

    // Add intent context
    contextHints.push(`Current intent: ${state.currentIntent.type} (confidence: ${(state.currentIntent.confidence * 100).toFixed(0)}%)`);

    // Add assessment context if applicable
    if (state.assessmentContext) {
      contextHints.push(`Assessment: IFRS ${state.assessmentContext.standard}, ${state.assessmentContext.phase} phase`);
      contextHints.push(`Progress: ${state.assessmentContext.progress}% (${state.assessmentContext.questionsAnswered} questions answered)`);
    }

    // Add key topics
    if (state.keyTopics.length > 0) {
      contextHints.push(`Key topics: ${state.keyTopics.slice(-3).join(', ')}`);
    }

    // Add follow-up context
    if (state.followUpHistory.length > 0) {
      const recentFollowUp = state.followUpHistory[state.followUpHistory.length - 1];
      if (recentFollowUp.isFollowUp) {
        contextHints.push('This appears to be a follow-up question');
      }
    }

    return {
      state,
      contextHints,
    };
  }

  /**
   * Build context-aware messages for AI
   */
  buildContextAwareMessages(
    sessionId: string,
    userId: string,
    baseMessages: Message[],
    _conversationHistory: Message[]
  ): Message[] {
    const { state, contextHints } = this.getContextForResponse(sessionId, userId);

    // Enhance system prompt with state context
    const systemMessage = baseMessages.find(msg => msg.role === 'system');
    
    if (systemMessage) {
      const enhancedSystemPrompt = `${systemMessage.content}

[Conversation Context]
${contextHints.join('\n')}

[State Information]
- Phase: ${state.conversationPhase}
- Intent: ${state.currentIntent.type}
${state.assessmentContext ? `- Assessment: IFRS ${state.assessmentContext.standard}, ${state.assessmentContext.phase} phase (${state.assessmentContext.progress}% complete)` : ''}
${state.keyTopics.length > 0 ? `- Topics: ${state.keyTopics.slice(-5).join(', ')}` : ''}

Please generate a response that:
- Aligns with the current conversation phase (${state.conversationPhase})
- Addresses the user's intent (${state.currentIntent.type})
${state.assessmentContext ? `- Reflects assessment progress (${state.assessmentContext.progress}%)` : ''}
${state.followUpHistory.length > 0 && state.followUpHistory[state.followUpHistory.length - 1].isFollowUp ? '- Acknowledges this is a follow-up question' : ''}`;

      // Replace system message with enhanced version
      const otherMessages = baseMessages.filter(msg => msg.role !== 'system');
      return [
        { role: 'system', content: enhancedSystemPrompt },
        ...otherMessages,
      ];
    }

    return baseMessages;
  }

  /**
   * Get state transition history (for debugging/analytics)
   */
  getStateTransition(
    _sessionId: string,
    oldPhase: ConversationState['conversationPhase'],
    newPhase: ConversationState['conversationPhase']
  ): StateTransition {
    return {
      from: oldPhase,
      to: newPhase,
      reason: this.getTransitionReason(oldPhase, newPhase),
      confidence: 0.8,
    };
  }

  /**
   * Get transition reason
   */
  private getTransitionReason(
    from: ConversationState['conversationPhase'],
    to: ConversationState['conversationPhase']
  ): string {
    if (from === 'initiation' && to === 'exploration') {
      return 'User started asking questions';
    }
    if (from === 'initiation' && to === 'assessment') {
      return 'User started assessment';
    }
    if (to === 'guidance') {
      return 'User requested guidance';
    }
    if (to === 'completion') {
      return 'Assessment completed';
    }
    return 'Phase transition based on conversation flow';
  }

  /**
   * Clear state for a session
   */
  clearState(sessionId: string): void {
    this.states.delete(sessionId);
  }

  /**
   * Get all states (for debugging/admin)
   */
  getAllStates(): ConversationState[] {
    return Array.from(this.states.values());
  }
}

// Export singleton instance
export const conversationStateService = new ConversationStateService();

// Export convenience functions
export function updateConversationState(
  sessionId: string,
  userId: string,
  message: string,
  conversationHistory: Message[]
): ConversationState {
  return conversationStateService.updateState(sessionId, userId, message, conversationHistory);
}

export function getConversationState(sessionId: string, userId: string): ConversationState {
  return conversationStateService.getState(sessionId, userId);
}

export function buildContextAwareMessages(
  sessionId: string,
  userId: string,
  baseMessages: Message[],
  conversationHistory: Message[]
): Message[] {
  return conversationStateService.buildContextAwareMessages(sessionId, userId, baseMessages, conversationHistory);
}
