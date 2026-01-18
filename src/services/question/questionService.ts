import { prisma } from '../../utils/db';
import type { AnswerData } from '../assessment/assessmentFlowEngine';

export interface QuestionFilters {
  category?: string;
  ifrsStandard?: 'S1' | 'S2';
  phase?: 'quick' | 'detailed' | 'followup';
  isActive?: boolean;
  priority?: 'high' | 'medium' | 'low';
  excludeAnswered?: string[]; // Question IDs to exclude
}

export interface SkipLogicRule {
  questionId: string;
  operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 'less-than' | 'in' | 'not-in';
  value: any;
  action: 'skip' | 'require';
}

export interface PrioritizedQuestion extends QuestionWithCategory {
  priority: 'high' | 'medium' | 'low';
  priorityScore: number; // Calculated priority score
  shouldSkip: boolean;
  skipReason?: string;
}

export interface QuestionWithCategory {
  id: string;
  text: string;
  type: string;
  options: string | null;
  ifrsStandard: string;
  requirement: string | null;
  weight: number;
  order: number;
  phase: string;
  isActive: boolean;
  skipLogic: string | null;
  category: {
    id: string;
    name: string;
    description: string | null;
  };
}

export class QuestionService {
  /**
   * Get all questions with optional filters
   */
  async getQuestions(filters: QuestionFilters = {}): Promise<QuestionWithCategory[]> {
    const where: any = {};

    if (filters.category) {
      where.category = { name: filters.category };
    }

    if (filters.ifrsStandard) {
      where.ifrsStandard = filters.ifrsStandard;
    }

    if (filters.phase) {
      where.phase = filters.phase;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [
        { category: { name: 'asc' } },
        { order: 'asc' },
      ],
    });

    return questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      options: q.options,
      ifrsStandard: q.ifrsStandard,
      requirement: q.requirement,
      weight: q.weight,
      order: q.order,
      phase: q.phase,
      isActive: q.isActive,
      skipLogic: q.skipLogic,
      category: {
        id: q.category.id,
        name: q.category.name,
        description: q.category.description,
      },
    }));
  }

  /**
   * Get a single question by ID
   */
  async getQuestionById(id: string): Promise<QuestionWithCategory | null> {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!question) return null;

    return {
      id: question.id,
      text: question.text,
      type: question.type,
      options: question.options,
      ifrsStandard: question.ifrsStandard,
      requirement: question.requirement,
      weight: question.weight,
      order: question.order,
      phase: question.phase,
      isActive: question.isActive,
      skipLogic: question.skipLogic,
      category: {
        id: question.category.id,
        name: question.category.name,
        description: question.category.description,
      },
    };
  }

  /**
   * Get questions by category
   */
  async getQuestionsByCategory(categoryName: string): Promise<QuestionWithCategory[]> {
    return this.getQuestions({ category: categoryName, isActive: true });
  }

  /**
   * Get questions by IFRS standard
   */
  async getQuestionsByStandard(standard: 'S1' | 'S2'): Promise<QuestionWithCategory[]> {
    return this.getQuestions({ ifrsStandard: standard, isActive: true });
  }

  /**
   * Get questions by phase
   */
  async getQuestionsByPhase(phase: 'quick' | 'detailed' | 'followup', ifrsStandard?: 'S1' | 'S2'): Promise<QuestionWithCategory[]> {
    const filters: QuestionFilters = { phase, isActive: true };
    if (ifrsStandard) {
      filters.ifrsStandard = ifrsStandard;
    }
    return this.getQuestions(filters);
  }

  /**
   * Get all question categories
   */
  async getCategories() {
    return prisma.questionCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get total count of active questions with optional filters
   */
  async getTotalQuestionsCount(
    ifrsStandard?: 'S1' | 'S2',
    phase?: 'quick' | 'detailed' | 'followup'
  ): Promise<number> {
    const where: any = { isActive: true };
    if (ifrsStandard) {
      where.ifrsStandard = ifrsStandard;
    }
    if (phase) {
      where.phase = phase;
    }
    return prisma.question.count({ where });
  }

  /**
   * Apply skip logic to questions based on answers
   */
  applySkipLogic(
    questions: QuestionWithCategory[],
    answers: Map<string, AnswerData>
  ): QuestionWithCategory[] {
    return questions.filter(question => {
      if (!question.skipLogic) {
        return true; // No skip logic, include question
      }

      try {
        const skipRules: SkipLogicRule[] = JSON.parse(question.skipLogic);
        
        for (const rule of skipRules) {
          const answer = answers.get(rule.questionId);
          if (!answer) {
            // Dependency not answered, can't evaluate - include question
            continue;
          }

          const matches = this.evaluateSkipCondition(rule, answer.value);
          
          if (rule.action === 'skip' && matches) {
            return false; // Skip this question
          }
          
          if (rule.action === 'require' && !matches) {
            return false; // Required condition not met, skip
          }
        }
      } catch (error) {
        // Invalid skip logic JSON, include question
        console.error(`Invalid skip logic for question ${question.id}:`, error);
      }

      return true; // Include question
    });
  }

  /**
   * Evaluate skip condition
   */
  private evaluateSkipCondition(rule: SkipLogicRule, answerValue: any): boolean {
    switch (rule.operator) {
      case 'equals':
        return answerValue === rule.value;
      case 'not-equals':
        return answerValue !== rule.value;
      case 'contains':
        if (Array.isArray(answerValue)) {
          return answerValue.includes(rule.value);
        }
        if (typeof answerValue === 'string') {
          return answerValue.includes(String(rule.value));
        }
        return false;
      case 'greater-than':
        return Number(answerValue) > Number(rule.value);
      case 'less-than':
        return Number(answerValue) < Number(rule.value);
      case 'in':
        if (Array.isArray(rule.value)) {
          return rule.value.includes(answerValue);
        }
        return false;
      case 'not-in':
        if (Array.isArray(rule.value)) {
          return !rule.value.includes(answerValue);
        }
        return true;
      default:
        return false;
    }
  }

  /**
   * Prioritize questions based on weight, category, and impact
   */
  prioritizeQuestions(
    questions: QuestionWithCategory[],
    options: {
      answeredQuestions?: Set<string>;
      gapsByCategory?: Map<string, number>;
      mode?: 'quick-scan' | 'standard' | 'deep-dive';
    } = {}
  ): PrioritizedQuestion[] {
    const { answeredQuestions = new Set(), gapsByCategory = new Map(), mode = 'standard' } = options;

    const prioritized: PrioritizedQuestion[] = questions.map(question => {
      // Calculate priority score
      let priorityScore = 0;

      // Base priority from weight (0-100)
      priorityScore += question.weight * 0.4;

      // Category priority (governance, strategy are high priority)
      const categoryPriority = this.getCategoryPriority(question.category.name);
      priorityScore += categoryPriority * 0.3;

      // Gap-based priority (if category has gaps, increase priority)
      if (gapsByCategory.has(question.category.name)) {
        priorityScore += 20;
      }

      // Mode-based priority adjustment
      if (mode === 'quick-scan' && question.priority !== 'high') {
        priorityScore *= 0.7; // Reduce priority for non-high questions in quick scan
      }

      // Determine priority level
      let priority: 'high' | 'medium' | 'low';
      if (priorityScore >= 70) {
        priority = 'high';
      } else if (priorityScore >= 40) {
        priority = 'medium';
      } else {
        priority = 'low';
      }

      // Check if should skip (basic check - full skip logic applied separately)
      const shouldSkip = answeredQuestions.has(question.id);

      return {
        ...question,
        priority,
        priorityScore: Math.round(priorityScore),
        shouldSkip,
      };
    });

    // Sort by priority score (descending)
    return prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Get category priority score
   */
  private getCategoryPriority(categoryName: string): number {
    const categoryLower = categoryName.toLowerCase();
    
    // High priority categories
    if (categoryLower.includes('governance') || categoryLower.includes('board')) {
      return 90;
    }
    if (categoryLower.includes('strategy') || categoryLower.includes('business model')) {
      return 85;
    }
    if (categoryLower.includes('risk')) {
      return 80;
    }
    
    // Medium priority categories
    if (categoryLower.includes('metrics') || categoryLower.includes('targets')) {
      return 60;
    }
    if (categoryLower.includes('disclosure') || categoryLower.includes('reporting')) {
      return 55;
    }
    
    // Default priority
    return 50;
  }

  /**
   * Get prioritized questions with skip logic applied
   */
  async getPrioritizedQuestions(
    filters: QuestionFilters = {},
    answers: Map<string, AnswerData> = new Map(),
    options: {
      gapsByCategory?: Map<string, number>;
      mode?: 'quick-scan' | 'standard' | 'deep-dive';
    } = {}
  ): Promise<PrioritizedQuestion[]> {
    // Get base questions
    const questions = await this.getQuestions(filters);

    // Apply skip logic
    const filteredQuestions = this.applySkipLogic(questions, answers);

    // Exclude answered questions if specified
    let candidateQuestions = filteredQuestions;
    if (filters.excludeAnswered) {
      candidateQuestions = filteredQuestions.filter(
        q => !filters.excludeAnswered!.includes(q.id)
      );
    }

    // Prioritize questions
    const prioritized = this.prioritizeQuestions(candidateQuestions, {
      answeredQuestions: new Set(filters.excludeAnswered || []),
      gapsByCategory: options.gapsByCategory,
      mode: options.mode,
    });

    return prioritized;
  }

  /**
   * Get high-impact questions (focus on high-impact areas first)
   */
  async getHighImpactQuestions(
    ifrsStandard?: 'S1' | 'S2',
    answers: Map<string, AnswerData> = new Map()
  ): Promise<PrioritizedQuestion[]> {
    const filters: QuestionFilters = {
      ifrsStandard,
      isActive: true,
      priority: 'high',
    };

    return this.getPrioritizedQuestions(filters, answers, {
      mode: 'standard',
    });
  }

  /**
   * Get questions for specific category with prioritization
   */
  async getPrioritizedQuestionsByCategory(
    categoryName: string,
    answers: Map<string, AnswerData> = new Map(),
    options: {
      gapsByCategory?: Map<string, number>;
      mode?: 'quick-scan' | 'standard' | 'deep-dive';
    } = {}
  ): Promise<PrioritizedQuestion[]> {
    const filters: QuestionFilters = {
      category: categoryName,
      isActive: true,
    };

    return this.getPrioritizedQuestions(filters, answers, options);
  }
}
