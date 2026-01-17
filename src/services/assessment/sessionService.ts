import { prisma } from '../../utils/db';

export interface SaveSessionData {
  assessmentId: string;
  userId: string;
  answers: Array<{ questionId: string; value: string }>;
  progress: number;
  status?: 'in_progress' | 'completed' | 'paused';
  ifrsStandard?: 'S1' | 'S2';
  phase?: 'quick' | 'detailed' | 'followup';
}

/**
 * Session Persistence Service
 * Handles saving and restoring assessment sessions
 */
export class SessionService {
  /**
   * Save or update assessment session
   */
  async saveSession(data: SaveSessionData): Promise<void> {
    const { assessmentId, userId, answers, progress, status, ifrsStandard, phase } = data;

    // Ensure user exists (create if not)
    let user = await prisma.user.findUnique({ where: { email: userId } });
    if (!user) {
      // For now, using email as userId. In production, this should be actual user ID
      user = await prisma.user.create({
        data: {
          email: userId,
          name: userId,
        },
      });
    }

    // Find or create active session
    let session = await prisma.session.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!session) {
      session = await prisma.session.create({
        data: {
          userId: user.id,
          isActive: true,
        },
      });
    }

    // Update session last active time
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActive: new Date() },
    });

    // Find or create assessment
    let assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      assessment = await prisma.assessment.create({
        data: {
          id: assessmentId,
          userId: user.id,
          sessionId: session.id,
          status: status || 'in_progress',
          progress,
        },
      });
    } else {
      // Update existing assessment
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: status || assessment.status,
          progress,
          updatedAt: new Date(),
        },
      });
    }

    // Save/update answers
    for (const answer of answers) {
      // Delete existing answer if exists
      await prisma.answer.deleteMany({
        where: {
          assessmentId,
          questionId: answer.questionId,
        },
      });

      // Create new answer
      await prisma.answer.create({
        data: {
          assessmentId,
          questionId: answer.questionId,
          value: answer.value,
        },
      });
    }
  }

  /**
   * Restore assessment session from database
   */
  async restoreSession(assessmentId: string): Promise<{
    assessmentId: string;
    answers: Array<{ questionId: string; value: string }>;
    progress: number;
    status: string;
    ifrsStandard?: string;
    phase?: string;
  } | null> {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        answers: true,
      },
    });

    if (!assessment) {
      return null;
    }

    return {
      assessmentId: assessment.id,
      answers: assessment.answers.map((a) => ({
        questionId: a.questionId,
        value: a.value,
      })),
      progress: assessment.progress,
      status: assessment.status,
    };
  }

  /**
   * Get all assessments for a user
   */
  async getUserAssessments(userId: string): Promise<Array<{
    id: string;
    status: string;
    progress: number;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }>> {
    const user = await prisma.user.findUnique({
      where: { email: userId },
    });

    if (!user) {
      return [];
    }

    const assessments = await prisma.assessment.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        progress: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    return assessments;
  }

  /**
   * Delete assessment and its answers
   */
  async deleteSession(assessmentId: string): Promise<void> {
    await prisma.answer.deleteMany({
      where: { assessmentId },
    });

    await prisma.assessment.delete({
      where: { id: assessmentId },
    });
  }

  /**
   * Auto-save assessment (lightweight save that doesn't create new records)
   */
  async autoSave(assessmentId: string, answers: Array<{ questionId: string; value: string }>, progress: number): Promise<void> {
    // Check if assessment exists
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (assessment) {
      // Update progress only for auto-save
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          progress,
          updatedAt: new Date(),
        },
      });

      // Update answers (delete and recreate for simplicity)
      for (const answer of answers) {
        await prisma.answer.deleteMany({
          where: {
            assessmentId,
            questionId: answer.questionId,
          },
        });

        await prisma.answer.create({
          data: {
            assessmentId,
            questionId: answer.questionId,
            value: answer.value,
          },
        });
      }
    }
  }
}
