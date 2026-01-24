import { Request, Response } from 'express';
import { prisma } from '../utils/db';
import { ScoringService } from '../services/assessment/scoringService';
import { ProgressService, ProgressData } from '../services/assessment/progressService';
import { GapIdentificationService, GapAnalysis } from '../services/compliance/gapIdentificationService';
import { ComplianceMatrixService, ComplianceMatrix } from '../services/compliance/complianceMatrixService';

export interface DashboardData {
  userId: string;
  assessmentId?: string;
  readinessScore: {
    overallScore: number;
    overallPercentage: number;
    categoryScores: Array<{
      category: string;
      score: number;
      maxScore: number;
      percentage: number;
      answeredCount: number;
      totalCount: number;
    }>;
    totalAnswered: number;
    totalQuestions: number;
  };
  progress: ProgressData;
  complianceMatrix: ComplianceMatrix;
  gapAnalysis: GapAnalysis;
  recentActivity: Array<{
    id: string;
    action: string;
    timestamp: Date;
    assessmentId?: string;
  }>;
  historicalTrends?: {
    assessments: Array<{
      id: string;
      createdAt: Date;
      score: number;
      progress: number;
    }>;
  };
}

/**
 * Dashboard Controller
 * Aggregates data from multiple services for dashboard display
 */
export class DashboardController {
  private scoringService: ScoringService;
  private progressService: ProgressService;
  private gapIdentificationService: GapIdentificationService;
  private complianceMatrixService: ComplianceMatrixService;

  constructor() {
    this.scoringService = new ScoringService();
    this.progressService = new ProgressService();
    this.gapIdentificationService = new GapIdentificationService();
    this.complianceMatrixService = new ComplianceMatrixService();
  }

  /**
   * Get comprehensive dashboard data for a user
   * Aggregates scores, progress, compliance, and gaps
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.params.userId;
      const { assessmentId } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User ID required' });
        return;
      }

      // Get the most recent assessment or specified assessment
      let assessment;
      if (assessmentId) {
        assessment = await prisma.assessment.findFirst({
          where: {
            id: assessmentId as string,
            userId,
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
            scores: true,
          },
        });
      } else {
        assessment = await prisma.assessment.findFirst({
          where: {
            userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
            scores: true,
          },
        });
      }

      if (!assessment) {
        // Return empty dashboard if no assessment exists
        res.json({
          userId,
          readinessScore: {
            overallScore: 0,
            overallPercentage: 0,
            categoryScores: [],
            totalAnswered: 0,
            totalQuestions: 0,
          },
          progress: {
            answeredCount: 0,
            totalCount: 0,
            percentage: 0,
          },
          complianceMatrix: {
            ifrsStandard: 'S1',
            overallCompliance: 0,
            requirements: [],
            byCategory: {
              governance: { compliant: 0, total: 0, score: 0 },
              strategy: { compliant: 0, total: 0, score: 0 },
              risk: { compliant: 0, total: 0, score: 0 },
              metrics: { compliant: 0, total: 0, score: 0 },
            },
          },
          gapAnalysis: {
            ifrsStandard: 'S1',
            overallGap: 100,
            criticalGaps: [],
            highGaps: [],
            mediumGaps: [],
            lowGaps: [],
            byCategory: {
              governance: [],
              strategy: [],
              risk: [],
              metrics: [],
            },
            priorityActions: [],
          },
          recentActivity: [],
          historicalTrends: {
            assessments: [],
          },
        });
        return;
      }

      // Convert answers to format expected by services
      const answers = assessment.answers.map((answer) => ({
        questionId: answer.questionId,
        value: answer.value,
      }));

      // Determine IFRS standard from questions (default to S1 if mixed)
      const ifrsStandard = assessment.answers.length > 0
        ? (assessment.answers[0]?.question?.ifrsStandard as 'S1' | 'S2') || 'S1'
        : 'S1';

      // Calculate scores
      const readinessScore = await this.scoringService.calculateAssessmentScore(
        answers,
        ifrsStandard
      );

      // Calculate progress
      const answeredQuestionIds = assessment.answers.map((a) => a.questionId);
      const progress = await this.progressService.calculateProgress(
        answeredQuestionIds,
        ifrsStandard
      );

      // Generate compliance matrix
      const complianceMatrix = await this.complianceMatrixService.generateComplianceMatrix(
        ifrsStandard,
        answers
      );

      // Perform gap analysis
      const gapAnalysis = await this.gapIdentificationService.identifyGaps(
        ifrsStandard,
        answers
      );

      // Get recent activity (last 10 assessments)
      const recentAssessments = await prisma.assessment.findMany({
        where: {
          userId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      const recentActivity = recentAssessments.map((a) => ({
        id: a.id,
        action: `Assessment ${a.status}`,
        timestamp: a.updatedAt,
        assessmentId: a.id,
      }));

      // Get historical trends (last 5 assessments with scores)
      const historicalAssessments = await prisma.assessment.findMany({
        where: {
          userId,
          status: 'completed',
        },
        orderBy: {
          completedAt: 'desc',
        },
        take: 5,
        include: {
          scores: true,
        },
      });

      const historicalTrends = {
        assessments: historicalAssessments.map((a) => {
          // Calculate average score from category scores
          const avgScore = a.scores.length > 0
            ? a.scores.reduce((sum, s) => sum + s.score, 0) / a.scores.length
            : 0;

          return {
            id: a.id,
            createdAt: a.createdAt,
            score: avgScore,
            progress: a.progress,
          };
        }),
      };

      const dashboardData: DashboardData = {
        userId,
        assessmentId: assessment.id,
        readinessScore,
        progress,
        complianceMatrix,
        gapAnalysis,
        recentActivity,
        historicalTrends,
      };

      res.json(dashboardData);
    } catch (error) {
      console.error('Get dashboard data error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get readiness score only (lightweight endpoint)
   */
  async getReadinessScore(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.params.userId;
      const { assessmentId } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User ID required' });
        return;
      }

      let assessment;
      if (assessmentId) {
        assessment = await prisma.assessment.findFirst({
          where: {
            id: assessmentId as string,
            userId,
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
      } else {
        assessment = await prisma.assessment.findFirst({
          where: {
            userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
      }

      if (!assessment || assessment.answers.length === 0) {
        res.json({
          overallScore: 0,
          overallPercentage: 0,
          categoryScores: [],
          totalAnswered: 0,
          totalQuestions: 0,
        });
        return;
      }

      const answers = assessment.answers.map((answer) => ({
        questionId: answer.questionId,
        value: answer.value,
      }));

      const ifrsStandard = (assessment.answers[0]?.question?.ifrsStandard as 'S1' | 'S2') || 'S1';

      const readinessScore = await this.scoringService.calculateAssessmentScore(
        answers,
        ifrsStandard
      );

      res.json(readinessScore);
    } catch (error) {
      console.error('Get readiness score error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get progress data only (lightweight endpoint)
   */
  async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.params.userId;
      const { assessmentId } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User ID required' });
        return;
      }

      let assessment;
      if (assessmentId) {
        assessment = await prisma.assessment.findFirst({
          where: {
            id: assessmentId as string,
            userId,
          },
          include: {
            answers: true,
          },
        });
      } else {
        assessment = await prisma.assessment.findFirst({
          where: {
            userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            answers: true,
          },
        });
      }

      if (!assessment) {
        res.json({
          answeredCount: 0,
          totalCount: 0,
          percentage: 0,
        });
        return;
      }

      const answeredQuestionIds = assessment.answers.map((a) => a.questionId);
      const ifrsStandard = 'S1'; // Default, could be inferred from assessment metadata

      const progress = await this.progressService.calculateProgress(
        answeredQuestionIds,
        ifrsStandard
      );

      res.json(progress);
    } catch (error) {
      console.error('Get progress error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get gap analysis only (lightweight endpoint)
   */
  async getGapAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.params.userId;
      const { assessmentId, ifrsStandard } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User ID required' });
        return;
      }

      let assessment;
      if (assessmentId) {
        assessment = await prisma.assessment.findFirst({
          where: {
            id: assessmentId as string,
            userId,
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
      } else {
        assessment = await prisma.assessment.findFirst({
          where: {
            userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
      }

      if (!assessment || assessment.answers.length === 0) {
        res.json({
          ifrsStandard: (ifrsStandard as 'S1' | 'S2') || 'S1',
          overallGap: 100,
          criticalGaps: [],
          highGaps: [],
          mediumGaps: [],
          lowGaps: [],
          byCategory: {
            governance: [],
            strategy: [],
            risk: [],
            metrics: [],
          },
          priorityActions: [],
        });
        return;
      }

      const answers = assessment.answers.map((answer) => ({
        questionId: answer.questionId,
        value: answer.value,
      }));

      const standard = (ifrsStandard as 'S1' | 'S2') ||
        (assessment.answers[0]?.question?.ifrsStandard as 'S1' | 'S2') ||
        'S1';

      const gapAnalysis = await this.gapIdentificationService.identifyGaps(standard, answers);

      res.json(gapAnalysis);
    } catch (error) {
      console.error('Get gap analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get compliance matrix only (lightweight endpoint)
   */
  async getComplianceMatrix(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || req.params.userId;
      const { assessmentId, ifrsStandard } = req.query;

      if (!userId) {
        res.status(401).json({ error: 'User ID required' });
        return;
      }

      let assessment;
      if (assessmentId) {
        assessment = await prisma.assessment.findFirst({
          where: {
            id: assessmentId as string,
            userId,
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
      } else {
        assessment = await prisma.assessment.findFirst({
          where: {
            userId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        });
      }

      if (!assessment || assessment.answers.length === 0) {
        const standard = (ifrsStandard as 'S1' | 'S2') || 'S1';
        res.json({
          ifrsStandard: standard,
          overallCompliance: 0,
          requirements: [],
          byCategory: {
            governance: { compliant: 0, total: 0, score: 0 },
            strategy: { compliant: 0, total: 0, score: 0 },
            risk: { compliant: 0, total: 0, score: 0 },
            metrics: { compliant: 0, total: 0, score: 0 },
          },
        });
        return;
      }

      const answers = assessment.answers.map((answer) => ({
        questionId: answer.questionId,
        value: answer.value,
      }));

      const standard = (ifrsStandard as 'S1' | 'S2') ||
        (assessment.answers[0]?.question?.ifrsStandard as 'S1' | 'S2') ||
        'S1';

      const complianceMatrix = await this.complianceMatrixService.generateComplianceMatrix(
        standard,
        answers
      );

      res.json(complianceMatrix);
    } catch (error) {
      console.error('Get compliance matrix error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }
}
