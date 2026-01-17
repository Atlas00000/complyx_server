import { Request, Response } from 'express';
import { ComplianceMatrixService } from '../services/compliance/complianceMatrixService';
import { GapIdentificationService } from '../services/compliance/gapIdentificationService';
import { IndustryVariationsService } from '../services/compliance/industryVariationsService';

export class ComplianceController {
  private complianceMatrixService: ComplianceMatrixService;
  private gapIdentificationService: GapIdentificationService;
  private industryVariationsService: IndustryVariationsService;

  constructor() {
    this.complianceMatrixService = new ComplianceMatrixService();
    this.gapIdentificationService = new GapIdentificationService();
    this.industryVariationsService = new IndustryVariationsService();
  }

  /**
   * GET /api/compliance/matrix
   * Generate compliance matrix for an assessment
   */
  async getComplianceMatrix(req: Request, res: Response): Promise<void> {
    try {
      const { ifrsStandard, answers } = req.body;

      if (!ifrsStandard || !answers) {
        res.status(400).json({
          error: 'Missing required fields: ifrsStandard and answers',
        });
        return;
      }

      if (!['S1', 'S2'].includes(ifrsStandard)) {
        res.status(400).json({
          error: 'ifrsStandard must be "S1" or "S2"',
        });
        return;
      }

      const matrix = await this.complianceMatrixService.generateComplianceMatrix(
        ifrsStandard as 'S1' | 'S2',
        answers
      );

      // Map server response to client-expected format
      res.json({
        ifrsStandard: matrix.ifrsStandard,
        overallCompliance: matrix.overallCompliance,
        requirementStatuses: matrix.requirements, // Map requirements to requirementStatuses
        categoryBreakdown: matrix.byCategory, // Map byCategory to categoryBreakdown
      });
    } catch (error) {
      console.error('Error generating compliance matrix:', error);
      res.status(500).json({
        error: 'Failed to generate compliance matrix',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/compliance/gaps
   * Identify compliance gaps for an assessment
   */
  async identifyGaps(req: Request, res: Response): Promise<void> {
    try {
      const { ifrsStandard, answers } = req.body;

      if (!ifrsStandard || !answers) {
        res.status(400).json({
          error: 'Missing required fields: ifrsStandard and answers',
        });
        return;
      }

      if (!['S1', 'S2'].includes(ifrsStandard)) {
        res.status(400).json({
          error: 'ifrsStandard must be "S1" or "S2"',
        });
        return;
      }

      const gapAnalysis = await this.gapIdentificationService.identifyGaps(
        ifrsStandard as 'S1' | 'S2',
        answers
      );

      res.json(gapAnalysis);
    } catch (error) {
      console.error('Error identifying gaps:', error);
      res.status(500).json({
        error: 'Failed to identify gaps',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/compliance/industries
   * Get list of supported industries
   */
  async getIndustries(_req: Request, res: Response): Promise<void> {
    try {
      const industries = this.industryVariationsService.getSupportedIndustries();
      res.json({ industries });
    } catch (error) {
      console.error('Error getting industries:', error);
      res.status(500).json({
        error: 'Failed to get industries',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/compliance/industry/:industry
   * Get industry-specific context
   */
  async getIndustryContext(req: Request, res: Response): Promise<void> {
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

      const context = this.industryVariationsService.getIndustryContext(industryType);

      res.json(context);
    } catch (error) {
      console.error('Error getting industry context:', error);
      res.status(500).json({
        error: 'Failed to get industry context',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
