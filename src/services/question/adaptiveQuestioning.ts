import { QuestionService, QuestionWithCategory } from './questionService';

export interface AnswerData {
  questionId: string;
  value: string;
}

export interface QuestionFlowState {
  answeredQuestions: Set<string>;
  currentCategory?: string;
  currentPhase?: 'quick' | 'detailed' | 'followup';
  answeredAnswers: AnswerData[];
}

export class AdaptiveQuestioning {
  private questionService: QuestionService;

  constructor(questionService?: QuestionService) {
    this.questionService = questionService || new QuestionService();
  }

  /**
   * Get the next question based on current state and answers
   */
  async getNextQuestion(
    state: QuestionFlowState,
    ifrsStandard?: 'S1' | 'S2',
    phase?: 'quick' | 'detailed' | 'followup'
  ): Promise<QuestionWithCategory | null> {
    // Determine current phase
    let currentPhase = phase || state.currentPhase;
    
    // If no phase set, start with quick phase
    if (!currentPhase) {
      currentPhase = 'quick';
      state.currentPhase = 'quick';
    }

    // Check if current phase is complete, then move to next phase
    if (currentPhase === 'quick') {
      const quickQuestions = await this.questionService.getQuestionsByPhase('quick', ifrsStandard);
      const quickAnswered = quickQuestions.filter(q => state.answeredQuestions.has(q.id));
      
      // If quick phase is complete, move to detailed
      if (quickAnswered.length === quickQuestions.length && quickQuestions.length > 0) {
        currentPhase = 'detailed';
        state.currentPhase = 'detailed';
      }
    }

    // Get questions for current phase
    const filters: any = {
      isActive: true,
      phase: currentPhase,
    };
    if (ifrsStandard) {
      filters.ifrsStandard = ifrsStandard;
    }

    const phaseQuestions = await this.questionService.getQuestions(filters);

    // Filter out already answered questions
    const unansweredQuestions = phaseQuestions.filter(
      (q) => !state.answeredQuestions.has(q.id)
    );

    if (unansweredQuestions.length === 0) {
      // Current phase complete, check if we can move to next phase
      if (currentPhase === 'quick') {
        // Try detailed phase
        return this.getNextQuestion(state, ifrsStandard, 'detailed');
      }
      return null; // No more questions
    }

    // Determine next category if not set
    if (!state.currentCategory) {
      const nextCategory = this.determineNextCategory(state, unansweredQuestions);
      state.currentCategory = nextCategory;
    }

    // Get questions from current category
    let candidateQuestions = unansweredQuestions.filter(
      (q) => q.category.name === state.currentCategory
    );

    // If no questions in current category, move to next category
    if (candidateQuestions.length === 0) {
      const nextCategory = this.determineNextCategory(state, unansweredQuestions);
      state.currentCategory = nextCategory;
      candidateQuestions = unansweredQuestions.filter(
        (q) => q.category.name === nextCategory
      );
    }

    // Apply skip logic
    const filteredQuestions = this.applySkipLogic(
      candidateQuestions,
      state.answeredAnswers
    );

    // Select question based on priority (weight and order)
    if (filteredQuestions.length === 0) {
      // If all questions in category are skipped, try next category
      const remainingQuestions = unansweredQuestions.filter(
        (q) => q.category.name !== state.currentCategory
      );
      if (remainingQuestions.length > 0) {
        const nextCategory = this.determineNextCategory(state, remainingQuestions);
        state.currentCategory = nextCategory;
        return this.getNextQuestion(state, ifrsStandard);
      }
      return null;
    }

    // Sort by weight (descending) and order (ascending)
    filteredQuestions.sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return a.order - b.order;
    });

    return filteredQuestions[0];
  }

  /**
   * Determine the next category to focus on
   */
  private determineNextCategory(
    _state: QuestionFlowState,
    questions: QuestionWithCategory[]
  ): string {
    // Count questions per category
    const categoryCounts = new Map<string, number>();
    questions.forEach((q) => {
      const count = categoryCounts.get(q.category.name) || 0;
      categoryCounts.set(q.category.name, count + 1);
    });

    // Priority order: governance -> strategy -> risk -> metrics
    const priorityOrder = ['governance', 'strategy', 'risk', 'metrics'];

    // Find first category with questions
    for (const category of priorityOrder) {
      if (categoryCounts.has(category) && categoryCounts.get(category)! > 0) {
        return category;
      }
    }

    // Fallback to first available category
    return categoryCounts.keys().next().value || 'governance';
  }

  /**
   * Apply skip logic based on previous answers
   */
  private applySkipLogic(
    questions: QuestionWithCategory[],
    answers: AnswerData[]
  ): QuestionWithCategory[] {
    return questions.filter((question) => {
      if (!question.skipLogic) {
        return true; // No skip logic, include question
      }

      try {
        const skipLogic = JSON.parse(question.skipLogic);
        return this.evaluateSkipLogic(skipLogic, answers);
      } catch {
        // Invalid skip logic, include question
        return true;
      }
    });
  }

  /**
   * Evaluate skip logic conditions
   */
  private evaluateSkipLogic(skipLogic: any, answers: AnswerData[]): boolean {
    // Simple skip logic evaluation
    // Format: { "if": { "questionId": "xxx", "value": "yyy" }, "then": "skip" }
    if (skipLogic.if && skipLogic.then === 'skip') {
      const condition = skipLogic.if;
      const answer = answers.find((a) => a.questionId === condition.questionId);
      
      if (answer) {
        if (condition.operator === 'equals') {
          return answer.value !== condition.value;
        }
        if (condition.operator === 'not_equals') {
          return answer.value === condition.value;
        }
        // Default: include question if condition not met
        return true;
      }
    }

    return true; // Include question by default
  }

  /**
   * Get progress percentage
   */
  async getProgress(
    state: QuestionFlowState,
    ifrsStandard?: 'S1' | 'S2'
  ): Promise<number> {
    const filters: any = { isActive: true };
    if (ifrsStandard) {
      filters.ifrsStandard = ifrsStandard;
    }

    const totalQuestions = await this.questionService.getQuestions(filters);
    const totalCount = totalQuestions.length;
    const answeredCount = state.answeredQuestions.size;

    if (totalCount === 0) return 0;

    return Math.round((answeredCount / totalCount) * 100);
  }
}
