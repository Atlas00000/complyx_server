import { Request, Response } from 'express';
import { SessionService } from '../services/assessment/sessionService';

export class SessionController {
  private sessionService: SessionService;

  constructor() {
    this.sessionService = new SessionService();
  }

  /**
   * Save assessment session
   */
  async saveSession(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId, userId, answers, progress, status, ifrsStandard, phase } = req.body;

      if (!assessmentId || !userId || !answers) {
        res.status(400).json({ error: 'Missing required fields: assessmentId, userId, answers' });
        return;
      }

      await this.sessionService.saveSession({
        assessmentId,
        userId,
        answers,
        progress: progress || 0,
        status,
        ifrsStandard,
        phase,
      });

      res.json({ success: true, message: 'Session saved successfully' });
    } catch (error) {
      console.error('Save session error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Restore assessment session
   */
  async restoreSession(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      const session = await this.sessionService.restoreSession(assessmentId);

      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({ session });
    } catch (error) {
      console.error('Restore session error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get user's assessments
   */
  async getUserAssessments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const assessments = await this.sessionService.getUserAssessments(userId);
      res.json({ assessments });
    } catch (error) {
      console.error('Get user assessments error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Auto-save assessment
   */
  async autoSave(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId, answers, progress } = req.body;

      if (!assessmentId || !answers) {
        res.status(400).json({ error: 'Missing required fields: assessmentId, answers' });
        return;
      }

      await this.sessionService.autoSave(
        assessmentId,
        answers,
        progress || 0
      );

      res.json({ success: true, message: 'Auto-saved successfully' });
    } catch (error) {
      console.error('Auto-save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Delete assessment session
   */
  async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId } = req.params;
      await this.sessionService.deleteSession(assessmentId);
      res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) {
      console.error('Delete session error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }
}
