import { ScoringService } from '../../assessment/scoringService';
import { GapIdentificationService, ComplianceGap } from '../../compliance/gapIdentificationService';
import { IndustryVariationsService } from '../../compliance/industryVariationsService';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'governance' | 'strategy' | 'risk' | 'metrics';
  priority: 'critical' | 'high' | 'medium' | 'low';
  actionItems: string[];
  relatedGaps: string[]; // Gap IDs this recommendation addresses
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: 'high' | 'medium' | 'low';
}

export interface PersonalizedRecommendations {
  userId: string;
  assessmentId: string;
  recommendations: Recommendation[];
  prioritizedActions: Recommendation[];
  categoryBreakdown: {
    governance: Recommendation[];
    strategy: Recommendation[];
    risk: Recommendation[];
    metrics: Recommendation[];
  };
  nextSteps: string[];
}

/**
 * Recommendation Engine
 * Generates personalized recommendations based on assessment answers and gaps
 */
export class RecommendationEngine {
  private scoringService: ScoringService;
  private gapIdentificationService: GapIdentificationService;
  private industryVariationsService: IndustryVariationsService;

  constructor() {
    this.scoringService = new ScoringService();
    this.gapIdentificationService = new GapIdentificationService();
    this.industryVariationsService = new IndustryVariationsService();
  }

  /**
   * Generate personalized recommendations for an assessment
   */
  async generateRecommendations(
    assessmentId: string,
    userId: string,
    answers: Array<{ questionId: string; value: string }>,
    ifrsStandard: 'S1' | 'S2',
    industry?: 'financial_services' | 'energy' | 'manufacturing' | 'technology' | 'retail' | 'healthcare' | 'real_estate' | 'transportation' | 'agriculture' | 'other'
  ): Promise<PersonalizedRecommendations> {
    // Get assessment scores
    const scores = await this.scoringService.calculateAssessmentScore(
      answers,
      ifrsStandard
    );

    // Identify gaps
    const gapAnalysis = await this.gapIdentificationService.identifyGaps(
      ifrsStandard,
      answers
    );

    // Generate recommendations based on gaps
    const recommendations = this.generateRecommendationsFromGaps(gapAnalysis, ifrsStandard);

    // Add industry-specific recommendations
    if (industry) {
      const industryRecommendations = this.generateIndustryRecommendations(
        industry,
        gapAnalysis,
        scores
      );
      recommendations.push(...industryRecommendations);
    }

    // Prioritize recommendations
    const prioritizedActions = this.prioritizeRecommendations(recommendations);

    // Categorize recommendations
    const categoryBreakdown = {
      governance: recommendations.filter(r => r.category === 'governance'),
      strategy: recommendations.filter(r => r.category === 'strategy'),
      risk: recommendations.filter(r => r.category === 'risk'),
      metrics: recommendations.filter(r => r.category === 'metrics'),
    };

    // Generate next steps
    const nextSteps = this.generateNextSteps(prioritizedActions, gapAnalysis);

    return {
      userId,
      assessmentId,
      recommendations,
      prioritizedActions,
      categoryBreakdown,
      nextSteps,
    };
  }

  /**
   * Generate recommendations from identified gaps
   */
  private generateRecommendationsFromGaps(
    gapAnalysis: any,
    ifrsStandard: 'S1' | 'S2'
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Process critical gaps
    for (const gap of gapAnalysis.criticalGaps) {
      recommendations.push(this.createRecommendationFromGap(gap, 'critical', ifrsStandard));
    }

    // Process high priority gaps
    for (const gap of gapAnalysis.highGaps) {
      recommendations.push(this.createRecommendationFromGap(gap, 'high', ifrsStandard));
    }

    // Process medium priority gaps
    for (const gap of gapAnalysis.mediumGaps) {
      recommendations.push(this.createRecommendationFromGap(gap, 'medium', ifrsStandard));
    }

    // Process low priority gaps
    for (const gap of gapAnalysis.lowGaps) {
      recommendations.push(this.createRecommendationFromGap(gap, 'low', ifrsStandard));
    }

    return recommendations;
  }

  /**
   * Create a recommendation from a gap
   */
  private createRecommendationFromGap(
    gap: ComplianceGap,
    priority: 'critical' | 'high' | 'medium' | 'low',
    ifrsStandard: 'S1' | 'S2'
  ): Recommendation {
    const standardLabel = ifrsStandard === 'S1' ? 'sustainability' : 'climate';

    return {
      id: `rec-${gap.requirementId}-${Date.now()}`,
      title: `Address ${gap.title} (${gap.code})`,
      description: `Your organization has a ${gap.gap.toFixed(0)}% gap in ${gap.title}. ${gap.mandatory ? 'This is a mandatory requirement.' : 'This is an enhanced disclosure.'}`,
      category: gap.category as 'governance' | 'strategy' | 'risk' | 'metrics',
      priority,
      actionItems: gap.recommendations,
      relatedGaps: [gap.requirementId],
      estimatedEffort: this.estimateEffort(gap),
      impact: gap.mandatory ? 'high' : gap.severity === 'critical' ? 'high' : 'medium',
    };
  }

  /**
   * Generate industry-specific recommendations
   */
  private generateIndustryRecommendations(
    industry: string,
    gapAnalysis: any,
    scores: any
  ): Recommendation[] {
    const industryContext = this.industryVariationsService.getIndustryContext(
      industry as any
    );

    const recommendations: Recommendation[] = [];

    // Add industry-specific recommendations based on context
    if (industryContext.specificRisks.length > 0) {
      recommendations.push({
        id: `rec-industry-${industry}-risks`,
        title: `Address ${industryContext.name} Industry-Specific Risks`,
        description: `Focus on managing ${industryContext.name}-specific risks: ${industryContext.specificRisks.join(', ')}`,
        category: 'risk',
        priority: 'high',
        actionItems: [
          `Conduct ${industryContext.name}-specific risk assessment`,
          `Develop risk management strategies for identified risks`,
        ],
        relatedGaps: [],
        estimatedEffort: 'medium',
        impact: 'high',
      });
    }

    if (industryContext.keyMetrics.length > 0) {
      recommendations.push({
        id: `rec-industry-${industry}-metrics`,
        title: `Track ${industryContext.name} Industry-Specific Metrics`,
        description: `Ensure you are tracking and reporting on ${industryContext.name}-specific metrics: ${industryContext.keyMetrics.join(', ')}`,
        category: 'metrics',
        priority: 'medium',
        actionItems: [
          `Establish tracking systems for ${industryContext.keyMetrics.join(', ')}`,
          `Integrate industry metrics into reporting framework`,
        ],
        relatedGaps: [],
        estimatedEffort: 'medium',
        impact: 'medium',
      });
    }

    return recommendations;
  }

  /**
   * Prioritize recommendations
   */
  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    return recommendations.sort((a, b) => {
      // Sort by priority first
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Then by impact
      const impactOrder = { high: 0, medium: 1, low: 2 };
      if (impactOrder[a.impact] !== impactOrder[b.impact]) {
        return impactOrder[a.impact] - impactOrder[b.impact];
      }

      // Then by effort (lower effort first)
      const effortOrder = { low: 0, medium: 1, high: 2 };
      return effortOrder[a.estimatedEffort] - effortOrder[b.estimatedEffort];
    });
  }

  /**
   * Estimate effort for addressing a gap
   */
  private estimateEffort(gap: ComplianceGap): 'low' | 'medium' | 'high' {
    if (gap.gap > 70) {
      return 'high';
    }
    if (gap.gap > 40) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate next steps from prioritized actions
   */
  private generateNextSteps(
    prioritizedActions: Recommendation[],
    gapAnalysis: any
  ): string[] {
    const nextSteps: string[] = [];

    // Add immediate actions for critical gaps
    const criticalActions = prioritizedActions.filter(r => r.priority === 'critical');
    if (criticalActions.length > 0) {
      nextSteps.push(`Immediate: Address ${criticalActions.length} critical gap(s) - these are mandatory requirements`);
    }

    // Add high priority actions
    const highActions = prioritizedActions.filter(r => r.priority === 'high');
    if (highActions.length > 0) {
      nextSteps.push(`Priority: Focus on ${highActions.length} high-priority recommendation(s)`);
    }

    // Add category-specific next steps
    const categoryGaps = {
      governance: gapAnalysis.byCategory.governance.length,
      strategy: gapAnalysis.byCategory.strategy.length,
      risk: gapAnalysis.byCategory.risk.length,
      metrics: gapAnalysis.byCategory.metrics.length,
    };

    const maxCategory = Object.entries(categoryGaps).reduce((a, b) => 
      categoryGaps[a[0] as keyof typeof categoryGaps] > categoryGaps[b[0] as keyof typeof categoryGaps] ? a : b
    );

    if (categoryGaps[maxCategory[0] as keyof typeof categoryGaps] > 0) {
      nextSteps.push(`Focus Area: ${maxCategory[0]} has the most gaps - prioritize improvements in this area`);
    }

    return nextSteps;
  }

  /**
   * Get recommendations for a specific category
   */
  async getCategoryRecommendations(
    assessmentId: string,
    category: 'governance' | 'strategy' | 'risk' | 'metrics',
    answers: Array<{ questionId: string; value: string }>,
    ifrsStandard: 'S1' | 'S2'
  ): Promise<Recommendation[]> {
    const recommendations = await this.generateRecommendations(
      assessmentId,
      'user', // Would be actual userId
      answers,
      ifrsStandard
    );

    return recommendations.categoryBreakdown[category];
  }
}
