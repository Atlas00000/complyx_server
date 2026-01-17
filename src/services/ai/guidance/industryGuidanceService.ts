import { IndustryVariationsService, IndustryType } from '../../compliance/industryVariationsService';
import { GapIdentificationService } from '../../compliance/gapIdentificationService';
import { ScoringService } from '../../assessment/scoringService';

export interface IndustryGuidance {
  industry: IndustryType;
  guidance: string;
  specificRecommendations: string[];
  bestPractices: string[];
  commonPitfalls: string[];
  resources: string[];
}

export interface ContextualGuidance {
  guidance: string;
  recommendations: string[];
  examples: string[];
  nextSteps: string[];
}

/**
 * Industry Guidance Service
 * Provides industry-specific guidance and recommendations
 */
export class IndustryGuidanceService {
  private industryVariationsService: IndustryVariationsService;
  private gapIdentificationService: GapIdentificationService;
  private scoringService: ScoringService;

  constructor() {
    this.industryVariationsService = new IndustryVariationsService();
    this.gapIdentificationService = new GapIdentificationService();
    this.scoringService = new ScoringService();
  }

  /**
   * Get industry-specific guidance
   */
  getIndustryGuidance(industry: IndustryType): IndustryGuidance {
    const context = this.industryVariationsService.getIndustryContext(industry);

    // Generate guidance based on industry
    const guidance = this.generateIndustryGuidance(context);
    const specificRecommendations = this.generateIndustryRecommendations(context);
    const bestPractices = this.generateBestPractices(industry);
    const commonPitfalls = this.generateCommonPitfalls(industry);
    const resources = this.generateResources(industry);

    return {
      industry,
      guidance,
      specificRecommendations,
      bestPractices,
      commonPitfalls,
      resources,
    };
  }

  /**
   * Get contextual guidance based on assessment state
   */
  async getContextualGuidance(
    industry: IndustryType,
    answers: Array<{ questionId: string; value: string }>,
    ifrsStandard: 'S1' | 'S2',
    progress: number
  ): Promise<ContextualGuidance> {
    // Get gap analysis
    const gapAnalysis = await this.gapIdentificationService.identifyGaps(
      ifrsStandard,
      answers
    );

    // Get scores
    const scores = await this.scoringService.calculateAssessmentScore(
      answers,
      ifrsStandard
    );

    // Generate contextual guidance
    const guidance = this.generateContextualGuidance(
      industry,
      gapAnalysis,
      scores,
      progress
    );

    const recommendations = this.generateContextualRecommendations(
      industry,
      gapAnalysis,
      scores
    );

    const examples = this.generateExamples(industry, gapAnalysis);
    const nextSteps = this.generateNextSteps(gapAnalysis, progress);

    return {
      guidance,
      recommendations,
      examples,
      nextSteps,
    };
  }

  /**
   * Generate industry-specific guidance text
   */
  private generateIndustryGuidance(context: any): string {
    let guidance = `For ${context.name} organizations, IFRS compliance requires special attention to:\n\n`;

    if (context.specificRisks.length > 0) {
      guidance += `**Key Risks:**\n`;
      context.specificRisks.forEach((risk: string, index: number) => {
        guidance += `${index + 1}. ${risk}\n`;
      });
      guidance += '\n';
    }

    if (context.keyMetrics.length > 0) {
      guidance += `**Key Metrics:**\n`;
      context.keyMetrics.forEach((metric: string, index: number) => {
        guidance += `${index + 1}. ${metric}\n`;
      });
      guidance += '\n';
    }

    guidance += `Ensure your governance, strategy, risk management, and metrics frameworks address these ${context.name}-specific considerations.`;

    return guidance;
  }

  /**
   * Generate industry-specific recommendations
   */
  private generateIndustryRecommendations(context: any): string[] {
    const recommendations: string[] = [];

    if (context.specificRisks.length > 0) {
      recommendations.push(
        `Develop comprehensive risk management strategies for ${context.name}-specific risks`
      );
    }

    if (context.keyMetrics.length > 0) {
      recommendations.push(
        `Establish tracking and reporting systems for ${context.name}-specific metrics`
      );
    }

    if (context.additionalRequirements.length > 0) {
      recommendations.push(
        `Consider additional ${context.name} industry requirements: ${context.additionalRequirements.join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Generate best practices for an industry
   */
  private generateBestPractices(industry: IndustryType): string[] {
    const practices: Map<IndustryType, string[]> = new Map([
      ['financial_services', [
        'Integrate climate risk into credit risk assessment',
        'Develop green finance frameworks',
        'Disclose financed emissions',
        'Align with TCFD recommendations',
      ]],
      ['energy', [
        'Develop comprehensive energy transition plans',
        'Track and report Scope 1, 2, and 3 emissions',
        'Assess physical risks to infrastructure',
        'Set science-based targets',
      ]],
      ['manufacturing', [
        'Assess supply chain climate risks',
        'Implement circular economy principles',
        'Track energy efficiency improvements',
        'Engage suppliers on sustainability',
      ]],
      ['technology', [
        'Optimize data center energy efficiency',
        'Implement e-waste management programs',
        'Track renewable energy usage',
        'Assess supply chain transparency',
      ]],
      ['retail', [
        'Assess supply chain climate impacts',
        'Track product lifecycle emissions',
        'Implement sustainable sourcing policies',
        'Engage consumers on sustainability',
      ]],
    ]);

    return practices.get(industry) || [
      'Establish clear governance structures',
      'Integrate sustainability into strategy',
      'Develop comprehensive risk management',
      'Track relevant metrics and targets',
    ];
  }

  /**
   * Generate common pitfalls for an industry
   */
  private generateCommonPitfalls(industry: IndustryType): string[] {
    const pitfalls: Map<IndustryType, string[]> = new Map([
      ['financial_services', [
        'Underestimating transition risk in portfolios',
        'Not considering physical risk to assets',
        'Lack of green finance disclosure',
      ]],
      ['energy', [
        'Incomplete Scope 3 emissions tracking',
        'Insufficient transition planning',
        'Underestimating regulatory risks',
      ]],
      ['manufacturing', [
        'Overlooking supply chain risks',
        'Insufficient Scope 3 emissions data',
        'Lack of circular economy integration',
      ]],
    ]);

    return pitfalls.get(industry) || [
      'Insufficient governance oversight',
      'Lack of integration with strategy',
      'Incomplete risk assessment',
      'Missing metrics and targets',
    ];
  }

  /**
   * Generate resources for an industry
   */
  private generateResources(industry: IndustryType): string[] {
    return [
      'IFRS S1 and S2 official standards',
      'Industry-specific guidance documents',
      'TCFD recommendations',
      'Sector-specific best practices',
    ];
  }

  /**
   * Generate contextual guidance based on assessment state
   */
  private generateContextualGuidance(
    industry: IndustryType,
    gapAnalysis: any,
    scores: any,
    progress: number
  ): string {
    const context = this.industryVariationsService.getIndustryContext(industry);
    let guidance = '';

    if (progress < 30) {
      guidance = `You're in the early stages of your ${context.name} IFRS assessment. `;
      guidance += `Focus on establishing foundational governance and strategy frameworks.`;
    } else if (progress < 70) {
      guidance = `You're making good progress on your ${context.name} IFRS assessment. `;
      guidance += `Continue addressing identified gaps, particularly in risk management and metrics.`;
    } else {
      guidance = `You're well advanced in your ${context.name} IFRS assessment. `;
      guidance += `Focus on finalizing disclosures and ensuring comprehensive coverage.`;
    }

    if (gapAnalysis.overallGap > 50) {
      guidance += `\n\n**Important:** You have significant compliance gaps (${gapAnalysis.overallGap}%). `;
      guidance += `Prioritize addressing critical and high-priority gaps immediately.`;
    }

    return guidance;
  }

  /**
   * Generate contextual recommendations
   */
  private generateContextualRecommendations(
    industry: IndustryType,
    gapAnalysis: any,
    scores: any
  ): string[] {
    const recommendations: string[] = [];
    const context = this.industryVariationsService.getIndustryContext(industry);

    // Add gap-based recommendations
    if (gapAnalysis.criticalGaps.length > 0) {
      recommendations.push(
        `Address ${gapAnalysis.criticalGaps.length} critical gap(s) immediately - these are mandatory requirements`
      );
    }

    // Add industry-specific recommendations
    if (context.specificRisks.length > 0) {
      recommendations.push(
        `Pay special attention to ${context.name}-specific risks: ${context.specificRisks.join(', ')}`
      );
    }

    // Add category-specific recommendations
    const categoryScores = scores.categoryScores;
    const lowestCategory = categoryScores.reduce((min: any, cat: any) =>
      cat.percentage < min.percentage ? cat : min
    );

    if (lowestCategory.percentage < 50) {
      recommendations.push(
        `Strengthen your ${lowestCategory.category} framework - this area has the lowest compliance score`
      );
    }

    return recommendations;
  }

  /**
   * Generate examples for guidance
   */
  private generateExamples(industry: IndustryType, gapAnalysis: any): string[] {
    const examples: string[] = [];

    if (gapAnalysis.byCategory.governance.length > 0) {
      examples.push('Example: Establish a sustainability committee with board oversight');
    }

    if (gapAnalysis.byCategory.strategy.length > 0) {
      examples.push('Example: Integrate sustainability into annual strategic planning process');
    }

    if (gapAnalysis.byCategory.risk.length > 0) {
      examples.push('Example: Conduct quarterly climate risk assessments');
    }

    if (gapAnalysis.byCategory.metrics.length > 0) {
      examples.push('Example: Track and report key sustainability metrics quarterly');
    }

    return examples;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(gapAnalysis: any, progress: number): string[] {
    const nextSteps: string[] = [];

    if (progress < 50) {
      nextSteps.push('Complete the assessment to identify all gaps');
      nextSteps.push('Review identified gaps and prioritize actions');
    } else {
      nextSteps.push('Address critical and high-priority gaps');
      nextSteps.push('Develop action plans for each gap category');
      nextSteps.push('Implement improvements and track progress');
    }

    if (gapAnalysis.criticalGaps.length > 0) {
      nextSteps.push(`Immediate: Address ${gapAnalysis.criticalGaps.length} critical gap(s)`);
    }

    return nextSteps;
  }
}
