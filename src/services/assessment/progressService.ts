import { prisma } from '../../utils/db';
import { QuestionService } from '../question/questionService';

export interface ProgressData {
  answeredCount: number;
  totalCount: number;
  percentage: number;
  phase?: 'quick' | 'detailed' | 'followup';
}

/**
 * Progress Tracking Service
 * Tracks assessment progress including answered questions and completion status
 */
export class ProgressService {
  private questionService: QuestionService;

  constructor(questionService?: QuestionService) {
    this.questionService = questionService || new QuestionService();
  }

  /**
   * Calculate progress based on answered questions
   */
  async calculateProgress(
    answeredQuestionIds: string[],
    ifrsStandard?: 'S1' | 'S2',
    phase?: 'quick' | 'detailed' | 'followup'
  ): Promise<ProgressData> {
    // Get total questions count
    const filters: any = { isActive: true };
    if (ifrsStandard) {
      filters.ifrsStandard = ifrsStandard;
    }
    if (phase) {
      filters.phase = phase;
    }

    const totalQuestions = await this.questionService.getTotalQuestionsCount(
      ifrsStandard,
      phase
    );

    const answeredSet = new Set(answeredQuestionIds);
    const answeredCount = answeredSet.size;

    const percentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    return {
      answeredCount,
      totalCount: totalQuestions,
      percentage,
      phase,
    };
  }

  /**
   * Update assessment progress in database
   */
  async updateAssessmentProgress(
    assessmentId: string,
    progress: number
  ): Promise<void> {
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        progress,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get assessment progress from database
   */
  async getAssessmentProgress(assessmentId: string): Promise<number> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { progress: true },
    });

    return assessment?.progress || 0;
  }

  /**
   * Mark assessment as completed
   */
  async markAssessmentCompleted(assessmentId: string): Promise<void> {
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Mark assessment as paused
   */
  async markAssessmentPaused(assessmentId: string): Promise<void> {
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'paused',
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Resume paused assessment
   */
  async resumeAssessment(assessmentId: string): Promise<void> {
    await prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: 'in_progress',
        updatedAt: new Date(),
      },
    });
  }
}
