import { Request, Response } from 'express';
import { QuestionService } from '../services/question/questionService';
import { AdaptiveQuestioning } from '../services/question/adaptiveQuestioning';
import { QuestionTemplateService } from '../services/question/questionTemplates';
import { PhaseService } from '../services/question/phaseService';
import { cacheGet, cacheSet, cacheKey } from '../utils/redisCache';

export class QuestionController {
  private questionService: QuestionService;
  private adaptiveQuestioning: AdaptiveQuestioning;
  private templateService: QuestionTemplateService;
  private phaseService: PhaseService;

  constructor() {
    this.questionService = new QuestionService();
    this.adaptiveQuestioning = new AdaptiveQuestioning(this.questionService);
    this.templateService = new QuestionTemplateService();
    this.phaseService = new PhaseService(this.questionService);
  }

  /**
   * Get all questions with optional filters. Unfiltered list is cached in Redis (60s TTL).
   */
  async getQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { category, ifrsStandard, isActive } = req.query;

      const filters: any = {};
      if (category) filters.category = category as string;
      if (ifrsStandard) filters.ifrsStandard = ifrsStandard as 'S1' | 'S2';
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      const hasFilters = Object.keys(filters).length > 0;
      const cacheKeyQuestions = cacheKey(['questions', 'list']);

      if (!hasFilters) {
        const cached = await cacheGet<{ questions: unknown[] }>(cacheKeyQuestions);
        if (cached?.questions) {
          res.json(cached);
          return;
        }
      }

      const questions = await this.questionService.getQuestions(filters);
      if (!hasFilters) {
        await cacheSet(cacheKeyQuestions, { questions }, 60);
      }
      res.json({ questions });
    } catch (error) {
      console.error('Get questions error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get a single question by ID
   */
  async getQuestionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const question = await this.questionService.getQuestionById(id);

      if (!question) {
        res.status(404).json({ error: 'Question not found' });
        return;
      }

      res.json({ question });
    } catch (error) {
      console.error('Get question by ID error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get all question categories. Result cached in Redis (60s TTL).
   */
  async getCategories(_req: Request, res: Response): Promise<void> {
    try {
      const key = cacheKey(['questions', 'categories']);
      const cached = await cacheGet<{ categories: unknown[] }>(key);
      if (cached?.categories) {
        res.json(cached);
        return;
      }
      const categories = await this.questionService.getCategories();
      await cacheSet(key, { categories }, 60);
      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get next question using adaptive questioning
   */
  async getNextQuestion(req: Request, res: Response): Promise<void> {
    try {
      const { answeredQuestions = [], answeredAnswers = [], ifrsStandard, phase } = req.body;

      const flowState = {
        answeredQuestions: new Set(answeredQuestions as string[]),
        answeredAnswers: answeredAnswers as Array<{ questionId: string; value: string }>,
        currentPhase: phase as 'quick' | 'detailed' | 'followup' | undefined,
      };

      const nextQuestion = await this.adaptiveQuestioning.getNextQuestion(
        flowState,
        ifrsStandard as 'S1' | 'S2' | undefined,
        phase as 'quick' | 'detailed' | 'followup' | undefined
      );

      if (!nextQuestion) {
        res.json({ 
          question: null, 
          message: 'No more questions available',
          currentPhase: flowState.currentPhase,
        });
        return;
      }

      // Format question for chat
      const formattedQuestion = this.templateService.formatQuestionForChat(nextQuestion);

      res.json({
        question: nextQuestion,
        formattedQuestion,
        currentPhase: flowState.currentPhase,
      });
    } catch (error) {
      console.error('Get next question error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get phase information
   */
  async getPhaseInfo(req: Request, res: Response): Promise<void> {
    try {
      const { ifrsStandard } = req.query;
      const phaseInfo = await this.phaseService.getPhaseInfo(
        ifrsStandard as 'S1' | 'S2' | undefined
      );
      res.json({ phases: phaseInfo });
    } catch (error) {
      console.error('Get phase info error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get questions for a specific phase
   */
  async getPhaseQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { phase } = req.params;
      const { ifrsStandard } = req.query;
      
      const questions = await this.phaseService.getPhaseQuestions(
        phase as 'quick' | 'detailed' | 'followup',
        ifrsStandard as 'S1' | 'S2' | undefined
      );
      
      res.json({ questions });
    } catch (error) {
      console.error('Get phase questions error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }

  /**
   * Get assessment progress
   */
  async getProgress(req: Request, res: Response): Promise<void> {
    try {
      const { answeredQuestions = [], ifrsStandard } = req.body;

      const flowState = {
        answeredQuestions: new Set(answeredQuestions as string[]),
        answeredAnswers: [],
      };

      const progress = await this.adaptiveQuestioning.getProgress(
        flowState,
        ifrsStandard as 'S1' | 'S2' | undefined
      );

      res.json({ progress });
    } catch (error) {
      console.error('Get progress error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  }
}
