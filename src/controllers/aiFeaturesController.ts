import { Request, Response } from 'express';
import { RecommendationEngine } from '../services/ai/recommendations/recommendationEngine';
import { CitationService } from '../services/ai/citations/citationService';
import { IndustryGuidanceService } from '../services/ai/guidance/industryGuidanceService';

export class AIFeaturesController {
  private recommendationEngine: RecommendationEngine;
  private citationService: CitationService;
  private industryGuidanceService: IndustryGuidanceService;

  constructor() {
    this.recommendationEngine = new RecommendationEngine();
    this.citationService = new CitationService();
    this.industryGuidanceService = new IndustryGuidanceService();
  }

  /**
   * POST /api/ai/recommendations
   * Generate personalized recommendations
   */
  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { assessmentId, userId, answers, ifrsStandard, industry } = req.body;

      if (!assessmentId || !answers || !ifrsStandard) {
        res.status(400).json({
          error: 'Missing required fields: assessmentId, answers, and ifrsStandard',
        });
        return;
      }

      if (!['S1', 'S2'].includes(ifrsStandard)) {
        res.status(400).json({
          error: 'ifrsStandard must be "S1" or "S2"',
        });
        return;
      }

      const recommendations = await this.recommendationEngine.generateRecommendations(
        assessmentId,
        userId || 'anonymous',
        answers,
        ifrsStandard as 'S1' | 'S2',
        industry
      );

      res.json(recommendations);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({
        error: 'Failed to generate recommendations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/ai/citations
   * Extract citations from text and calculate confidence
   */
  async getCitations(req: Request, res: Response): Promise<void> {
    try {
      const { text, mentionedRequirements } = req.body;

      if (!text || typeof text !== 'string') {
        res.status(400).json({
          error: 'Missing required field: text',
        });
        return;
      }

      const citations = this.citationService.extractCitations(text, mentionedRequirements);
      const responseWithCitations = this.citationService.addCitationsToResponse(text, citations);

      res.json(responseWithCitations);
    } catch (error) {
      console.error('Error extracting citations:', error);
      res.status(500).json({
        error: 'Failed to extract citations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/ai/guidance/industry/:industry
   * Get industry-specific guidance
   */
  async getIndustryGuidance(req: Request, res: Response): Promise<void> {
    try {
      const { industry } = req.params;

      const industryType = industry as
        | 'financial_services'
        | 'energy'
        | 'manufacturing'
        | 'technology'
        | 'retail'
        | 'healthcare'
        | 'real_estate'
        | 'transportation'
        | 'agriculture'
        | 'other';

      const guidance = this.industryGuidanceService.getIndustryGuidance(industryType);

      res.json(guidance);
    } catch (error) {
      console.error('Error getting industry guidance:', error);
      res.status(500).json({
        error: 'Failed to get industry guidance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/ai/guidance/contextual
   * Get contextual guidance based on assessment state
   */
  async getContextualGuidance(req: Request, res: Response): Promise<void> {
    try {
      const { industry, answers, ifrsStandard, progress } = req.body;

      if (!industry || !answers || !ifrsStandard) {
        res.status(400).json({
          error: 'Missing required fields: industry, answers, and ifrsStandard',
        });
        return;
      }

      if (!['S1', 'S2'].includes(ifrsStandard)) {
        res.status(400).json({
          error: 'ifrsStandard must be "S1" or "S2"',
        });
        return;
      }

      const industryType = industry as
        | 'financial_services'
        | 'energy'
        | 'manufacturing'
        | 'technology'
        | 'retail'
        | 'healthcare'
        | 'real_estate'
        | 'transportation'
        | 'agriculture'
        | 'other';

      const guidance = await this.industryGuidanceService.getContextualGuidance(
        industryType,
        answers,
        ifrsStandard as 'S1' | 'S2',
        progress || 0
      );

      res.json(guidance);
    } catch (error) {
      console.error('Error getting contextual guidance:', error);
      res.status(500).json({
        error: 'Failed to get contextual guidance',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
