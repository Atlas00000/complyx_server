import { ComplianceMatrixService, ComplianceMatrix, RequirementStatus } from './complianceMatrixService';

export interface ComplianceGap {
  requirementId: string;
  code: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  score: number;
  gap: number; // Gap percentage (100 - score)
  answeredQuestions: number;
  totalQuestions: number;
  missingAnswers: string[]; // Question IDs that haven't been answered
  recommendations: string[];
  mandatory: boolean;
}

export interface GapAnalysis {
  ifrsStandard: 'S1' | 'S2';
  overallGap: number; // Overall gap percentage
  criticalGaps: ComplianceGap[];
  highGaps: ComplianceGap[];
  mediumGaps: ComplianceGap[];
  lowGaps: ComplianceGap[];
  byCategory: {
    governance: ComplianceGap[];
    strategy: ComplianceGap[];
    risk: ComplianceGap[];
    metrics: ComplianceGap[];
  };
  priorityActions: string[];
}

/**
 * Gap Identification Service
 * Identifies compliance gaps and provides prioritized recommendations
 */
export class GapIdentificationService {
  private complianceMatrixService: ComplianceMatrixService;

  constructor() {
    this.complianceMatrixService = new ComplianceMatrixService();
  }

  /**
   * Perform gap analysis for an assessment
   */
  async identifyGaps(
    ifrsStandard: 'S1' | 'S2',
    answers: Array<{ questionId: string; value: string }>
  ): Promise<GapAnalysis> {
    // Generate compliance matrix
    const matrix = await this.complianceMatrixService.generateComplianceMatrix(ifrsStandard, answers);

    // Identify gaps for each requirement
    const gaps: ComplianceGap[] = [];

    for (const requirement of matrix.requirements) {
      if (requirement.score < 100) {
        // There is a gap
        const gap = 100 - requirement.score;
        const severity = this.determineSeverity(gap, requirement.mandatory);

        const missingAnswers = this.identifyMissingAnswers(
          requirement,
          answers,
          ifrsStandard
        );

        const recommendations = this.generateRecommendations(
          requirement,
          gap,
          ifrsStandard
        );

        gaps.push({
          requirementId: requirement.requirementId,
          code: requirement.code,
          title: requirement.title,
          category: requirement.category,
          severity,
          score: requirement.score,
          gap,
          answeredQuestions: requirement.answeredQuestions,
          totalQuestions: requirement.totalQuestions,
          missingAnswers,
          recommendations,
          mandatory: requirement.mandatory,
        });
      }
    }

    // Categorize gaps by severity
    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    const highGaps = gaps.filter(g => g.severity === 'high');
    const mediumGaps = gaps.filter(g => g.severity === 'medium');
    const lowGaps = gaps.filter(g => g.severity === 'low');

    // Calculate overall gap (100 - overall compliance)
    const overallGap = 100 - matrix.overallCompliance;

    // Group gaps by category
    const byCategory = {
      governance: gaps.filter(g => g.category === 'governance'),
      strategy: gaps.filter(g => g.category === 'strategy'),
      risk: gaps.filter(g => g.category === 'risk'),
      metrics: gaps.filter(g => g.category === 'metrics'),
    };

    // Generate priority actions
    const priorityActions = this.generatePriorityActions(gaps, ifrsStandard);

    return {
      ifrsStandard,
      overallGap: Math.round(overallGap),
      criticalGaps,
      highGaps,
      mediumGaps,
      lowGaps,
      byCategory,
      priorityActions,
    };
  }

  /**
   * Determine gap severity based on gap percentage and mandatory status
   */
  private determineSeverity(gap: number, mandatory: boolean): 'critical' | 'high' | 'medium' | 'low' {
    if (mandatory && gap > 50) {
      return 'critical'; // Mandatory requirement with >50% gap
    }
    if (mandatory && gap > 30) {
      return 'high'; // Mandatory requirement with >30% gap
    }
    if (gap > 50) {
      return 'high'; // Any requirement with >50% gap
    }
    if (gap > 30) {
      return 'medium'; // Gap between 30-50%
    }
    return 'low'; // Gap <30%
  }

  /**
   * Identify missing answers for a requirement
   */
  private identifyMissingAnswers(
    requirement: RequirementStatus,
    answers: Array<{ questionId: string; value: string }>,
    ifrsStandard: 'S1' | 'S2'
  ): string[] {
    // This is a simplified implementation
    // In a full implementation, we would query the database for questions
    // associated with this requirement and check which ones are missing answers
    const answeredQuestionIds = new Set(answers.map(a => a.questionId));
    
    // For now, return empty array - this would be enhanced to query actual questions
    // TODO: Query database for requirement questions and identify missing ones
    return [];
  }

  /**
   * Generate recommendations for addressing a gap
   */
  private generateRecommendations(
    requirement: RequirementStatus,
    gap: number,
    ifrsStandard: 'S1' | 'S2'
  ): string[] {
    const recommendations: string[] = [];

    const standardLabel = ifrsStandard === 'S1' ? 'sustainability' : 'climate';

    if (requirement.answeredQuestions === 0) {
      recommendations.push(`Start collecting data and documentation for ${requirement.title} (${requirement.code})`);
    }

    if (requirement.score < 50) {
      recommendations.push(
        `Establish clear governance processes and controls for ${standardLabel}-related ${requirement.category}`
      );
    }

    if (requirement.mandatory && gap > 30) {
      recommendations.push(
        `Prioritize addressing ${requirement.code} as it is a mandatory requirement with significant gaps`
      );
    }

    if (requirement.category === 'governance') {
      recommendations.push('Ensure board oversight and management accountability for sustainability matters');
    } else if (requirement.category === 'strategy') {
      recommendations.push('Integrate sustainability considerations into strategic planning and decision-making');
    } else if (requirement.category === 'risk') {
      recommendations.push('Develop comprehensive risk identification and assessment processes');
    } else if (requirement.category === 'metrics') {
      recommendations.push('Establish metrics and targets aligned with IFRS requirements');
    }

    return recommendations;
  }

  /**
   * Generate priority actions based on identified gaps
   */
  private generatePriorityActions(gaps: ComplianceGap[], ifrsStandard: 'S1' | 'S2'): string[] {
    const actions: string[] = [];

    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    const highGaps = gaps.filter(g => g.severity === 'high');

    if (criticalGaps.length > 0) {
      actions.push(`Address ${criticalGaps.length} critical gap(s) immediately - these are mandatory requirements with significant compliance gaps`);
    }

    if (highGaps.length > 0) {
      actions.push(`Prioritize ${highGaps.length} high-priority gap(s) to improve overall compliance`);
    }

    // Add category-specific actions
    const hasGovernanceGaps = gaps.some(g => g.category === 'governance' && g.severity !== 'low');
    const hasStrategyGaps = gaps.some(g => g.category === 'strategy' && g.severity !== 'low');
    const hasRiskGaps = gaps.some(g => g.category === 'risk' && g.severity !== 'low');
    const hasMetricsGaps = gaps.some(g => g.category === 'metrics' && g.severity !== 'low');

    if (hasGovernanceGaps) {
      actions.push('Strengthen governance structures and oversight mechanisms');
    }
    if (hasStrategyGaps) {
      actions.push('Integrate sustainability into strategic planning and business model');
    }
    if (hasRiskGaps) {
      actions.push('Enhance risk management processes and controls');
    }
    if (hasMetricsGaps) {
      actions.push('Develop comprehensive metrics and reporting systems');
    }

    return actions;
  }

  /**
   * Get prioritized gap list (sorted by severity and priority)
   */
  async getPrioritizedGaps(
    ifrsStandard: 'S1' | 'S2',
    answers: Array<{ questionId: string; value: string }>
  ): Promise<ComplianceGap[]> {
    const gapAnalysis = await this.identifyGaps(ifrsStandard, answers);

    // Combine all gaps and sort by priority
    const allGaps = [
      ...gapAnalysis.criticalGaps,
      ...gapAnalysis.highGaps,
      ...gapAnalysis.mediumGaps,
      ...gapAnalysis.lowGaps,
    ];

    // Sort by: mandatory first, then by gap percentage (highest first)
    return allGaps.sort((a, b) => {
      if (a.mandatory !== b.mandatory) {
        return a.mandatory ? -1 : 1;
      }
      return b.gap - a.gap;
    });
  }
}
