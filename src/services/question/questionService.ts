import { prisma } from '../../utils/db';

export interface QuestionFilters {
  category?: string;
  ifrsStandard?: 'S1' | 'S2';
  phase?: 'quick' | 'detailed' | 'followup';
  isActive?: boolean;
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
}
