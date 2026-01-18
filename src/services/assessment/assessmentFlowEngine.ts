/**
 * Assessment Flow Engine
 * Core engine for adaptive questioning logic and smart branching system
 */

export interface AssessmentContext {
  sessionId: string;
  userId: string;
  ifrsStandard: 'S1' | 'S2' | 'both';
  mode: 'quick-scan' | 'standard' | 'deep-dive' | 'continuous-monitoring';
  phase: 'initiation' | 'exploration' | 'assessment' | 'completion';
  currentCategory?: string;
  answeredQuestions: Set<string>;
  answers: Map<string, AnswerData>;
  gaps: Gap[];
  progress: number; // 0-100
  startedAt: Date;
  lastUpdated: Date;
}

export interface AnswerData {
  questionId: string;
  value: string | number | boolean | string[];
  confidence?: number; // User's confidence in answer (0-1)
  notes?: string;
  answeredAt: Date;
}

export interface Gap {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  relatedQuestions: string[];
  recommendations: string[];
}

export interface QuestionNode {
  id: string;
  question: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  dependsOn?: string[]; // Question IDs that must be answered first
  skipConditions?: SkipCondition[];
  branchConditions?: BranchCondition[];
  format: 'yes-no' | 'multiple-choice' | 'scale' | 'open-ended' | 'multi-select';
  options?: string[]; // For multiple choice
  scaleRange?: { min: number; max: number; step?: number };
}

export interface SkipCondition {
  questionId: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than';
  value: any;
  action: 'skip' | 'require';
}

export interface BranchCondition {
  questionId: string;
  operator: 'equals' | 'not-equals' | 'contains';
  value: any;
  targetQuestionId: string; // Question to branch to
}

export interface FlowDecision {
  nextQuestion?: QuestionNode;
  shouldSkip: boolean;
  reason?: string;
  branchTo?: string; // Question ID to branch to
}

/**
 * Assessment Flow Engine
 * Implements adaptive questioning logic and smart branching
 */
export class AssessmentFlowEngine {
  private questionGraph: Map<string, QuestionNode> = new Map();
  private context: AssessmentContext | null = null;

  constructor() {
    // Initialize with default question structure
    this.initializeQuestionGraph();
  }

  /**
   * Initialize question graph with default structure
   */
  private initializeQuestionGraph(): void {
    // This will be populated with actual questions from question service
    // For now, we define the structure
  }

  /**
   * Start a new assessment
   */
  startAssessment(
    sessionId: string,
    userId: string,
    ifrsStandard: 'S1' | 'S2' | 'both',
    mode: 'quick-scan' | 'standard' | 'deep-dive' | 'continuous-monitoring'
  ): AssessmentContext {
    this.context = {
      sessionId,
      userId,
      ifrsStandard,
      mode,
      phase: 'initiation',
      answeredQuestions: new Set(),
      answers: new Map(),
      gaps: [],
      progress: 0,
      startedAt: new Date(),
      lastUpdated: new Date(),
    };

    return this.context;
  }

  /**
   * Get the next question based on adaptive logic
   */
  getNextQuestion(context: AssessmentContext): FlowDecision {
    this.context = context;

    // Update phase based on progress
    this.updatePhase();

    // Get candidate questions
    const candidates = this.getCandidateQuestions();

    if (candidates.length === 0) {
      return {
        shouldSkip: false,
        reason: 'No more questions available',
      };
    }

    // Apply adaptive logic
    const selectedQuestion = this.selectQuestion(candidates);

    if (!selectedQuestion) {
      return {
        shouldSkip: false,
        reason: 'No suitable question found',
      };
    }

    // Check skip conditions
    const skipResult = this.checkSkipConditions(selectedQuestion);
    if (skipResult.shouldSkip) {
      // Try next question
      const remainingCandidates = candidates.filter(q => q.id !== selectedQuestion.id);
      if (remainingCandidates.length > 0) {
        return this.getNextQuestion(context);
      }
      return skipResult;
    }

    // Check branch conditions
    const branchResult = this.checkBranchConditions(selectedQuestion);
    if (branchResult.branchTo) {
      const branchQuestion = this.questionGraph.get(branchResult.branchTo);
      if (branchQuestion) {
        return {
          nextQuestion: branchQuestion,
          shouldSkip: false,
          branchTo: branchResult.branchTo,
        };
      }
    }

    return {
      nextQuestion: selectedQuestion,
      shouldSkip: false,
    };
  }

  /**
   * Submit an answer and update context
   */
  submitAnswer(
    context: AssessmentContext,
    questionId: string,
    answer: AnswerData
  ): AssessmentContext {
    context.answeredQuestions.add(questionId);
    context.answers.set(questionId, {
      ...answer,
      answeredAt: new Date(),
    });
    context.lastUpdated = new Date();

    // Update progress
    this.updateProgress(context);

    // Detect gaps based on answer
    this.detectGaps(context, questionId, answer);

    return context;
  }

  /**
   * Get candidate questions based on current context
   */
  private getCandidateQuestions(): QuestionNode[] {
    if (!this.context) {
      return [];
    }

    const candidates: QuestionNode[] = [];

    // Filter by IFRS standard
    // Filter by mode (quick-scan, standard, deep-dive)
    // Filter out already answered questions
    // Filter by dependencies (only include if dependencies are met)

    for (const [questionId, question] of this.questionGraph.entries()) {
      // Skip if already answered
      if (this.context.answeredQuestions.has(questionId)) {
        continue;
      }

      // Check dependencies
      if (question.dependsOn && !this.areDependenciesMet(question.dependsOn)) {
        continue;
      }

      candidates.push(question);
    }

    return candidates;
  }

  /**
   * Select the best question from candidates using adaptive logic
   */
  private selectQuestion(candidates: QuestionNode[]): QuestionNode | null {
    if (candidates.length === 0) {
      return null;
    }

    // Prioritize by:
    // 1. Priority (high > medium > low)
    // 2. Category progression (start with governance, then strategy, etc.)
    // 3. Dependencies (questions with fewer dependencies first)
    // 4. Mode-specific selection

    const prioritized = candidates.sort((a, b) => {
      // Priority comparison
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Category progression (if context has current category)
      if (this.context?.currentCategory) {
        if (a.category === this.context.currentCategory && b.category !== this.context.currentCategory) {
          return -1;
        }
        if (b.category === this.context.currentCategory && a.category !== this.context.currentCategory) {
          return 1;
        }
      }

      // Dependencies count (fewer dependencies first)
      const aDeps = a.dependsOn?.length || 0;
      const bDeps = b.dependsOn?.length || 0;
      return aDeps - bDeps;
    });

    return prioritized[0];
  }

  /**
   * Check if dependencies are met
   */
  private areDependenciesMet(dependencies: string[]): boolean {
    if (!this.context) {
      return false;
    }

    return dependencies.every(depId => this.context!.answeredQuestions.has(depId));
  }

  /**
   * Check skip conditions for a question
   */
  private checkSkipConditions(question: QuestionNode): FlowDecision {
    if (!question.skipConditions || !this.context) {
      return { shouldSkip: false };
    }

    for (const condition of question.skipConditions) {
      const answer = this.context.answers.get(condition.questionId);
      if (!answer) {
        // Dependency not answered yet, can't evaluate skip
        continue;
      }

      const shouldSkip = this.evaluateCondition(condition, answer.value);
      
      if (condition.action === 'skip' && shouldSkip) {
        return {
          shouldSkip: true,
          reason: `Skip condition met: ${condition.questionId} ${condition.operator} ${condition.value}`,
        };
      }

      if (condition.action === 'require' && !shouldSkip) {
        return {
          shouldSkip: true,
          reason: `Required condition not met: ${condition.questionId} ${condition.operator} ${condition.value}`,
        };
      }
    }

    return { shouldSkip: false };
  }

  /**
   * Check branch conditions for a question
   */
  private checkBranchConditions(question: QuestionNode): FlowDecision {
    if (!question.branchConditions || !this.context) {
      return { shouldSkip: false };
    }

    for (const condition of question.branchConditions) {
      const answer = this.context.answers.get(condition.questionId);
      if (!answer) {
        continue;
      }

      const matches = this.evaluateCondition(condition, answer.value);
      if (matches) {
        return {
          shouldSkip: false,
          branchTo: condition.targetQuestionId,
        };
      }
    }

    return { shouldSkip: false };
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: SkipCondition | BranchCondition, answerValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return answerValue === condition.value;
      case 'not-equals':
        return answerValue !== condition.value;
      case 'contains':
        if (Array.isArray(answerValue)) {
          return answerValue.includes(condition.value);
        }
        if (typeof answerValue === 'string') {
          return answerValue.includes(String(condition.value));
        }
        return false;
      case 'greater-than':
        return Number(answerValue) > Number(condition.value);
      case 'less-than':
        return Number(answerValue) < Number(condition.value);
      default:
        return false;
    }
  }

  /**
   * Update assessment phase based on progress
   */
  private updatePhase(): void {
    if (!this.context) {
      return;
    }

    if (this.context.progress >= 100) {
      this.context.phase = 'completion';
    } else if (this.context.progress > 0) {
      this.context.phase = 'assessment';
    } else if (this.context.answeredQuestions.size > 0) {
      this.context.phase = 'exploration';
    }
  }

  /**
   * Update progress percentage
   */
  private updateProgress(context: AssessmentContext): void {
    const totalQuestions = this.questionGraph.size;
    if (totalQuestions === 0) {
      context.progress = 0;
      return;
    }

    const answeredCount = context.answeredQuestions.size;
    context.progress = Math.min(100, Math.round((answeredCount / totalQuestions) * 100));
  }

  /**
   * Detect gaps based on answer
   */
  private detectGaps(context: AssessmentContext, questionId: string, answer: AnswerData): void {
    const question = this.questionGraph.get(questionId);
    if (!question) {
      return;
    }

    // Simple gap detection logic
    // In production, this would be more sophisticated
    if (answer.value === false || answer.value === 'no' || answer.value === 'No') {
      const existingGap = context.gaps.find(g => g.category === question.category);
      
      if (existingGap) {
        existingGap.relatedQuestions.push(questionId);
      } else {
        context.gaps.push({
          category: question.category,
          severity: question.priority === 'high' ? 'high' : 'medium',
          description: `Gap identified in ${question.category}`,
          relatedQuestions: [questionId],
          recommendations: [`Review ${question.category} requirements`],
        });
      }
    }
  }

  /**
   * Register a question in the flow graph
   */
  registerQuestion(question: QuestionNode): void {
    this.questionGraph.set(question.id, question);
  }

  /**
   * Register multiple questions
   */
  registerQuestions(questions: QuestionNode[]): void {
    questions.forEach(q => this.registerQuestion(q));
  }

  /**
   * Get current context
   */
  getContext(): AssessmentContext | null {
    return this.context;
  }

  /**
   * Get assessment summary
   */
  getAssessmentSummary(context: AssessmentContext): {
    progress: number;
    answeredCount: number;
    totalQuestions: number;
    gaps: Gap[];
    phase: string;
  } {
    return {
      progress: context.progress,
      answeredCount: context.answeredQuestions.size,
      totalQuestions: this.questionGraph.size,
      gaps: context.gaps,
      phase: context.phase,
    };
  }

  /**
   * Context-aware sequencing: Questions adapt to previous answers
   */
  getContextAwareNextQuestion(context: AssessmentContext): FlowDecision {
    this.context = context;

    // Analyze previous answers to determine context
    const answerAnalysis = this.analyzeAnswers(context);

    // Get candidate questions filtered by context
    const candidates = this.getContextualCandidates(context, answerAnalysis);

    if (candidates.length === 0) {
      return {
        shouldSkip: false,
        reason: 'No more questions available',
      };
    }

    // Apply progressive disclosure: start broad, drill down based on gaps
    const selectedQuestion = this.selectContextualQuestion(candidates, answerAnalysis);

    if (!selectedQuestion) {
      return {
        shouldSkip: false,
        reason: 'No suitable question found',
      };
    }

    // Check skip and branch conditions
    const skipResult = this.checkSkipConditions(selectedQuestion);
    if (skipResult.shouldSkip) {
      const remainingCandidates = candidates.filter(q => q.id !== selectedQuestion.id);
      if (remainingCandidates.length > 0) {
        return this.getContextAwareNextQuestion(context);
      }
      return skipResult;
    }

    const branchResult = this.checkBranchConditions(selectedQuestion);
    if (branchResult.branchTo) {
      const branchQuestion = this.questionGraph.get(branchResult.branchTo);
      if (branchQuestion) {
        return {
          nextQuestion: branchQuestion,
          shouldSkip: false,
          branchTo: branchResult.branchTo,
        };
      }
    }

    return {
      nextQuestion: selectedQuestion,
      shouldSkip: false,
    };
  }

  /**
   * Analyze previous answers to extract context
   */
  private analyzeAnswers(context: AssessmentContext): AnswerAnalysis {
    const analysis: AnswerAnalysis = {
      answeredCategories: new Set(),
      gapsByCategory: new Map(),
      confidenceLevel: 'medium',
      coverageByCategory: new Map(),
      negativeAnswers: [],
      positiveAnswers: [],
    };

    // Analyze each answer
    for (const [questionId, answer] of context.answers.entries()) {
      const question = this.questionGraph.get(questionId);
      if (!question) {
        continue;
      }

      // Track answered categories
      analysis.answeredCategories.add(question.category);

      // Track coverage
      const currentCoverage = analysis.coverageByCategory.get(question.category) || 0;
      analysis.coverageByCategory.set(question.category, currentCoverage + 1);

      // Identify negative answers (potential gaps)
      if (this.isNegativeAnswer(answer.value)) {
        analysis.negativeAnswers.push({
          questionId,
          category: question.category,
          answer: answer.value,
        });

        // Track gaps by category
        const gapCount = analysis.gapsByCategory.get(question.category) || 0;
        analysis.gapsByCategory.set(question.category, gapCount + 1);
      } else {
        analysis.positiveAnswers.push({
          questionId,
          category: question.category,
          answer: answer.value,
        });
      }

      // Calculate overall confidence
      if (answer.confidence !== undefined) {
        const currentConfidence = analysis.confidenceLevel === 'high' ? 0.8 : 
                                 analysis.confidenceLevel === 'medium' ? 0.5 : 0.2;
        const avgConfidence = (currentConfidence + answer.confidence) / 2;
        if (avgConfidence >= 0.7) {
          analysis.confidenceLevel = 'high';
        } else if (avgConfidence >= 0.4) {
          analysis.confidenceLevel = 'medium';
        } else {
          analysis.confidenceLevel = 'low';
        }
      }
    }

    return analysis;
  }

  /**
   * Check if answer is negative (indicates gap)
   */
  private isNegativeAnswer(value: any): boolean {
    if (typeof value === 'boolean') {
      return !value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower === 'no' || lower === 'false' || lower === 'none' || lower === 'not applicable';
    }
    if (typeof value === 'number') {
      return value === 0 || value < 0;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return false;
  }

  /**
   * Get contextual candidate questions
   */
  private getContextualCandidates(
    context: AssessmentContext,
    analysis: AnswerAnalysis
  ): QuestionNode[] {
    const candidates: QuestionNode[] = [];

    // Progressive disclosure strategy:
    // 1. Start with broad questions (high-level categories)
    // 2. If gaps detected, drill down into specific areas
    // 3. Prioritize categories with gaps

    const hasGaps = analysis.gapsByCategory.size > 0;
    const answeredCount = context.answeredQuestions.size;

    for (const [questionId, question] of this.questionGraph.entries()) {
      // Skip if already answered
      if (context.answeredQuestions.has(questionId)) {
        continue;
      }

      // Check dependencies
      if (question.dependsOn && !this.areDependenciesMet(question.dependsOn)) {
        continue;
      }

      // Progressive disclosure: early questions should be broad
      if (answeredCount < 5 && question.priority !== 'high') {
        // In early stage, focus on high-priority, broad questions
        if (question.priority === 'low' && question.category.includes('detail')) {
          continue; // Skip detailed questions early
        }
      }

      // If gaps detected, prioritize questions in those categories
      if (hasGaps) {
        const hasGapInCategory = analysis.gapsByCategory.has(question.category);
        if (hasGapInCategory) {
          candidates.push(question);
          continue;
        }
      }

      // Include all other valid candidates
      candidates.push(question);
    }

    return candidates;
  }

  /**
   * Select question based on context analysis
   */
  private selectContextualQuestion(
    candidates: QuestionNode[],
    analysis: AnswerAnalysis
  ): QuestionNode | null {
    if (candidates.length === 0) {
      return null;
    }

    // Sort by contextual priority
    const prioritized = candidates.sort((a, b) => {
      // 1. Prioritize categories with gaps
      const aHasGap = analysis.gapsByCategory.has(a.category);
      const bHasGap = analysis.gapsByCategory.has(b.category);
      if (aHasGap && !bHasGap) return -1;
      if (!aHasGap && bHasGap) return 1;

      // 2. Prioritize uncovered categories
      const aCoverage = analysis.coverageByCategory.get(a.category) || 0;
      const bCoverage = analysis.coverageByCategory.get(b.category) || 0;
      if (aCoverage < bCoverage) return -1;
      if (aCoverage > bCoverage) return 1;

      // 3. Priority level
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 4. Dependencies count
      const aDeps = a.dependsOn?.length || 0;
      const bDeps = b.dependsOn?.length || 0;
      return aDeps - bDeps;
    });

    return prioritized[0];
  }

  /**
   * Get questions for progressive disclosure (broad to specific)
   */
  getProgressiveQuestions(context: AssessmentContext, level: 'broad' | 'medium' | 'specific'): QuestionNode[] {
    const candidates = this.getCandidateQuestions();
    
    return candidates.filter(q => {
      // Broad questions: high-level, no dependencies, high priority
      if (level === 'broad') {
        return q.priority === 'high' && (!q.dependsOn || q.dependsOn.length === 0);
      }
      
      // Medium questions: some dependencies, medium priority
      if (level === 'medium') {
        return q.priority === 'medium' || (q.dependsOn && q.dependsOn.length > 0);
      }
      
      // Specific questions: detailed, many dependencies, low priority
      if (level === 'specific') {
        return q.priority === 'low' || (q.dependsOn && q.dependsOn.length > 2);
      }
      
      return true;
    });
  }
}

/**
 * Answer analysis for context-aware sequencing
 */
interface AnswerAnalysis {
  answeredCategories: Set<string>;
  gapsByCategory: Map<string, number>;
  confidenceLevel: 'high' | 'medium' | 'low';
  coverageByCategory: Map<string, number>;
  negativeAnswers: Array<{
    questionId: string;
    category: string;
    answer: any;
  }>;
  positiveAnswers: Array<{
    questionId: string;
    category: string;
    answer: any;
  }>;
}
