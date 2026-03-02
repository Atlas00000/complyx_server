import { Request, Response } from 'express';
import {
  InChatAssessmentService,
  AssessmentType,
  MicroTopic,
} from '../services/assessment/inChatAssessmentService';
import { getCompletionSummary } from '../services/assessment/assessmentCompletionService';

const inChatAssessmentService = new InChatAssessmentService();

/**
 * POST /api/assessment/start
 * Body: { userId, sessionId?, assessmentType: 'quick'|'micro'|'full', microTopic?: 'governance'|'strategy'|'risk'|'metrics' }
 */
export async function startInChatAssessment(req: Request, res: Response): Promise<void> {
  try {
    const { userId, sessionId, assessmentType, microTopic } = req.body;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (!assessmentType || !['quick', 'micro', 'full'].includes(assessmentType)) {
      res.status(400).json({ error: 'assessmentType must be quick, micro, or full' });
      return;
    }
    if (assessmentType === 'micro' && !microTopic) {
      res.status(400).json({
        error: 'microTopic is required when assessmentType is micro (governance, strategy, risk, metrics)',
      });
      return;
    }
    const validTopics: MicroTopic[] = ['governance', 'strategy', 'risk', 'metrics'];
    if (assessmentType === 'micro' && microTopic && !validTopics.includes(microTopic)) {
      res.status(400).json({ error: 'microTopic must be governance, strategy, risk, or metrics' });
      return;
    }

    const result = await inChatAssessmentService.startAssessment({
      userId,
      sessionId,
      assessmentType: assessmentType as AssessmentType,
      microTopic: assessmentType === 'micro' ? (microTopic as MicroTopic) : undefined,
    });

    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('User not found') || message.includes('Please log in')
        ? 401
        : 500;
    res.status(status).json({ error: message });
  }
}

/**
 * POST /api/assessment/answer
 * Body: { assessmentId, questionId, value }
 */
export async function submitInChatAnswer(req: Request, res: Response): Promise<void> {
  try {
    const { assessmentId, questionId, value } = req.body;

    if (!assessmentId || !questionId) {
      res.status(400).json({ error: 'assessmentId and questionId are required' });
      return;
    }
    if (value === undefined || value === null) {
      res.status(400).json({ error: 'value is required' });
      return;
    }

    const result = await inChatAssessmentService.submitAnswer({
      assessmentId,
      questionId,
      value: String(value),
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) res.status(404).json({ error: message });
    else if (message.includes('already completed')) res.status(400).json({ error: message });
    else res.status(500).json({ error: message });
  }
}

/**
 * GET /api/assessment/status/:assessmentId
 */
export async function getInChatAssessmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { assessmentId } = req.params;
    if (!assessmentId) {
      res.status(400).json({ error: 'assessmentId is required' });
      return;
    }

    const result = await inChatAssessmentService.getStatus(assessmentId);
    if (!result) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}

/**
 * GET /api/assessment/summary/:assessmentId
 * Returns scores, gaps, readiness band, and summary text for a completed assessment.
 */
export async function getInChatAssessmentSummary(req: Request, res: Response): Promise<void> {
  try {
    const { assessmentId } = req.params;
    if (!assessmentId) {
      res.status(400).json({ error: 'assessmentId is required' });
      return;
    }

    const result = await getCompletionSummary(assessmentId);
    if (!result) {
      res.status(404).json({ error: 'Assessment not found or not completed' });
      return;
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
}
