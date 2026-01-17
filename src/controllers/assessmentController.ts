import { Request, Response } from 'express';
import { ScoringService } from '../services/assessment/scoringService';
import { ProgressService } from '../services/assessment/progressService';

export class AssessmentController {
  private scoringService: ScoringService;
  private progressService: ProgressService;

  constructor() {
    this.scoringService = new ScoringService();
    this.progressService = new ProgressService();
  }

  /**
   * Calculate and return assessment scores
   */
  async calculateScores(req: Request, res: Response): Promise<void> {
    try {
      const { answers = [], ifrsStandard, phase, assessmentId } = req.body;

      const assessmentScore = await this.scoringService.calculateAssessmentScore(
        answers as Array<{ questionId: string; value: string }>,
        ifrsStandard as 'S1' | 'S2' | undefined,
        phase as 'quick' | 'detailed' | 'followup' | undefined
      );

      // If assessmentId provided, save scores to database
      if (assessmentId) {
        await this.scoringService.calculateAndSaveScores(
          assessmentId,
          answers as Array<{ questionId: string; value: string }>,
          ifrsStandard as 'S1' | 'S2' | undefined,
          phase as 'quick' | 'detailed' | 'followup' | undefined
        );
      }

      res.json({ scores: assessmentScore });
    } catch (error) {
      console.error('Calculate scores error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get scores for an assessment
   */
  async getScores(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const categoryScores = await this.scoringService.getAssessmentScores(assessmentId);
      res.json({ scores: categoryScores });
    } catch (error) {
      console.error('Get scores error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Calculate and return assessment progress
   */
  async calculateProgress(req: Request, res: Response): Promise<void> {
    try {
      const { answeredQuestions = [], ifrsStandard, phase } = req.body;

      const progress = await this.progressService.calculateProgress(
        answeredQuestions as string[],
        ifrsStandard as 'S1' | 'S2' | undefined,
        phase as 'quick' | 'detailed' | 'followup' | undefined
      );

      res.json({ progress });
    } catch (error) {
      console.error('Calculate progress error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Update assessment progress in database
   */
  async updateProgress(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const { progress } = req.body;

      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        res.status(400).json({ error: 'Progress must be a number between 0 and 100' });
        return;
      }

      await this.progressService.updateAssessmentProgress(assessmentId, progress);
      res.json({ success: true, progress });
    } catch (error) {
      console.error('Update progress error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Mark assessment as completed
   */
  async completeAssessment(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      await this.progressService.markAssessmentCompleted(assessmentId);
      res.json({ success: true, message: 'Assessment marked as completed' });
    } catch (error) {
      console.error('Complete assessment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Pause assessment
   */
  async pauseAssessment(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      await this.progressService.markAssessmentPaused(assessmentId);
      res.json({ success: true, message: 'Assessment paused' });
    } catch (error) {
      console.error('Pause assessment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Resume assessment
   */
  async resumeAssessment(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      await this.progressService.resumeAssessment(assessmentId);
      res.json({ success: true, message: 'Assessment resumed' });
    } catch (error) {
      console.error('Resume assessment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }
}
