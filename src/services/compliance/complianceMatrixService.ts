import { IFRSS1MappingService } from './ifrsS1Mapping';
import { IFRSS2MappingService } from './ifrsS2Mapping';

export interface RequirementStatus {
  requirementId: string;
  code: string;
  title: string;
  category: string;
  compliant: boolean;
  score: number;
  answeredQuestions: number;
  totalQuestions: number;
  level: 'core' | 'enhanced';
  mandatory: boolean;
}

export interface ComplianceMatrix {
  ifrsStandard: 'S1' | 'S2';
  overallCompliance: number; // 0-100
  requirements: RequirementStatus[];
  byCategory: {
    governance: { compliant: number; total: number; score: number };
    strategy: { compliant: number; total: number; score: number };
    risk: { compliant: number; total: number; score: number };
    metrics: { compliant: number; total: number; score: number };
  };
}

/**
 * Compliance Matrix Service
 * Calculates compliance matrix showing requirement status and overall compliance
 */
export class ComplianceMatrixService {
  private s1MappingService: IFRSS1MappingService;
  private s2MappingService: IFRSS2MappingService;

  constructor() {
    this.s1MappingService = new IFRSS1MappingService();
    this.s2MappingService = new IFRSS2MappingService();
  }

  /**
   * Generate compliance matrix for an assessment
   */
  async generateComplianceMatrix(
    ifrsStandard: 'S1' | 'S2',
    answers: Array<{ questionId: string; value: string }>
  ): Promise<ComplianceMatrix> {
    const mappingService = ifrsStandard === 'S1' ? this.s1MappingService : this.s2MappingService;
    const requirements = mappingService.getRequirements();

    // Check compliance for each requirement
    const requirementStatuses: RequirementStatus[] = [];

    for (const requirement of requirements) {
      try {
        const compliance = await mappingService.checkRequirementCompliance(requirement.code, answers);
        requirementStatuses.push({
          requirementId: compliance.requirement.id,
          code: compliance.requirement.code,
          title: compliance.requirement.title,
          category: compliance.requirement.category,
          compliant: compliance.compliant,
          score: compliance.score,
          answeredQuestions: compliance.answeredQuestions,
          totalQuestions: compliance.totalQuestions,
          level: compliance.requirement.level,
          mandatory: compliance.requirement.mandatory,
        });
      } catch (error) {
        console.error(`Error checking compliance for ${requirement.code}:`, error);
        // Default to non-compliant if check fails
        requirementStatuses.push({
          requirementId: requirement.id,
          code: requirement.code,
          title: requirement.title,
          category: requirement.category,
          compliant: false,
          score: 0,
          answeredQuestions: 0,
          totalQuestions: 0,
          level: requirement.level,
          mandatory: requirement.mandatory,
        });
      }
    }

    // Calculate overall compliance
    const compliantCount = requirementStatuses.filter(r => r.compliant).length;
    const totalMandatoryCount = requirementStatuses.filter(r => r.mandatory).length;
    const mandatoryCompliantCount = requirementStatuses.filter(r => r.mandatory && r.compliant).length;

    // Overall compliance based on mandatory requirements (70%) and all requirements (30%)
    const mandatoryCompliance = totalMandatoryCount > 0 
      ? (mandatoryCompliantCount / totalMandatoryCount) * 100 
      : 0;
    const allRequirementsCompliance = requirementStatuses.length > 0
      ? (compliantCount / requirementStatuses.length) * 100
      : 0;
    const overallCompliance = (mandatoryCompliance * 0.7) + (allRequirementsCompliance * 0.3);

    // Calculate compliance by category
    const byCategory = {
      governance: this.calculateCategoryCompliance(requirementStatuses, 'governance'),
      strategy: this.calculateCategoryCompliance(requirementStatuses, 'strategy'),
      risk: this.calculateCategoryCompliance(requirementStatuses, 'risk'),
      metrics: this.calculateCategoryCompliance(requirementStatuses, 'metrics'),
    };

    return {
      ifrsStandard,
      overallCompliance: Math.round(overallCompliance),
      requirements: requirementStatuses,
      byCategory,
    };
  }

  /**
   * Calculate compliance for a specific category
   */
  private calculateCategoryCompliance(
    requirementStatuses: RequirementStatus[],
    category: 'governance' | 'strategy' | 'risk' | 'metrics'
  ): { compliant: number; total: number; score: number } {
    const categoryRequirements = requirementStatuses.filter(r => r.category === category);
    const compliant = categoryRequirements.filter(r => r.compliant).length;
    const total = categoryRequirements.length;
    const score = total > 0
      ? categoryRequirements.reduce((sum, r) => sum + r.score, 0) / total
      : 0;

    return {
      compliant,
      total,
      score: Math.round(score),
    };
  }

  /**
   * Get compliance summary (high-level overview)
   */
  async getComplianceSummary(
    ifrsStandard: 'S1' | 'S2',
    answers: Array<{ questionId: string; value: string }>
  ): Promise<{
    ifrsStandard: 'S1' | 'S2';
    overallCompliance: number;
    mandatoryCompliant: number;
    mandatoryTotal: number;
    categorySummary: Array<{
      category: string;
      compliant: number;
      total: number;
      score: number;
    }>;
  }> {
    const matrix = await this.generateComplianceMatrix(ifrsStandard, answers);

    return {
      ifrsStandard: matrix.ifrsStandard,
      overallCompliance: matrix.overallCompliance,
      mandatoryCompliant: matrix.requirements.filter(r => r.mandatory && r.compliant).length,
      mandatoryTotal: matrix.requirements.filter(r => r.mandatory).length,
      categorySummary: [
        {
          category: 'governance',
          compliant: matrix.byCategory.governance.compliant,
          total: matrix.byCategory.governance.total,
          score: matrix.byCategory.governance.score,
        },
        {
          category: 'strategy',
          compliant: matrix.byCategory.strategy.compliant,
          total: matrix.byCategory.strategy.total,
          score: matrix.byCategory.strategy.score,
        },
        {
          category: 'risk',
          compliant: matrix.byCategory.risk.compliant,
          total: matrix.byCategory.risk.total,
          score: matrix.byCategory.risk.score,
        },
        {
          category: 'metrics',
          compliant: matrix.byCategory.metrics.compliant,
          total: matrix.byCategory.metrics.total,
          score: matrix.byCategory.metrics.score,
        },
      ],
    };
  }
}
