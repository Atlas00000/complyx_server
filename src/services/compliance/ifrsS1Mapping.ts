import { prisma } from '../../utils/db';

export interface IFRSRequirement {
  id: string;
  code: string; // e.g., "S1-1", "S1-2"
  title: string;
  description: string;
  category: 'governance' | 'strategy' | 'risk' | 'metrics';
  level: 'core' | 'enhanced'; // Core requirements vs enhanced disclosures
  mandatory: boolean;
}

export interface RequirementMapping {
  requirementId: string;
  requirement: IFRSRequirement;
  questionIds: string[];
  coverage: number; // Percentage of requirement covered by questions (0-100)
}

/**
 * IFRS S1 Requirement Mapping Service
 * Maps questions to specific IFRS S1 requirements and tracks compliance
 */
export class IFRSS1MappingService {
  /**
   * IFRS S1 Core Requirements
   * Based on IFRS S1: General Requirements for Disclosure of Sustainability-related Financial Information
   */
  private s1Requirements: IFRSRequirement[] = [
    // Governance (S1-1)
    {
      id: 's1-1',
      code: 'S1-1',
      title: 'Governance',
      description: 'Disclose governance processes, controls and procedures used to monitor and manage sustainability-related risks and opportunities.',
      category: 'governance',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-1a',
      code: 'S1-1a',
      title: 'Governance Body',
      description: 'Identify the governance body or bodies responsible for oversight of sustainability-related risks and opportunities.',
      category: 'governance',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-1b',
      code: 'S1-1b',
      title: 'Management Role',
      description: 'Describe management\'s role in assessing and managing sustainability-related risks and opportunities.',
      category: 'governance',
      level: 'core',
      mandatory: true,
    },

    // Strategy (S1-2)
    {
      id: 's1-2',
      code: 'S1-2',
      title: 'Strategy',
      description: 'Disclose how sustainability-related risks and opportunities are incorporated into strategy and decision-making.',
      category: 'strategy',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-2a',
      code: 'S1-2a',
      title: 'Impact on Strategy',
      description: 'Describe how sustainability-related risks and opportunities affect strategy and decision-making.',
      category: 'strategy',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-2b',
      code: 'S1-2b',
      title: 'Business Model Resilience',
      description: 'Assess the resilience of the business model and strategy to sustainability-related risks and opportunities.',
      category: 'strategy',
      level: 'enhanced',
      mandatory: false,
    },

    // Risk Management (S1-3)
    {
      id: 's1-3',
      code: 'S1-3',
      title: 'Risk Management',
      description: 'Disclose processes used to identify, assess, and manage sustainability-related risks.',
      category: 'risk',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-3a',
      code: 'S1-3a',
      title: 'Risk Identification',
      description: 'Describe processes to identify sustainability-related risks.',
      category: 'risk',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-3b',
      code: 'S1-3b',
      title: 'Risk Integration',
      description: 'Explain how sustainability-related risks are integrated into overall risk management processes.',
      category: 'risk',
      level: 'core',
      mandatory: true,
    },

    // Metrics and Targets (S1-4)
    {
      id: 's1-4',
      code: 'S1-4',
      title: 'Metrics and Targets',
      description: 'Disclose metrics and targets used to assess performance in relation to sustainability-related risks and opportunities.',
      category: 'metrics',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-4a',
      code: 'S1-4a',
      title: 'Metrics Disclosure',
      description: 'Disclose metrics used to measure performance against sustainability-related risks and opportunities.',
      category: 'metrics',
      level: 'core',
      mandatory: true,
    },
    {
      id: 's1-4b',
      code: 'S1-4b',
      title: 'Targets Disclosure',
      description: 'Disclose targets related to sustainability-related risks and opportunities.',
      category: 'metrics',
      level: 'enhanced',
      mandatory: false,
    },
  ];

  /**
   * Get all IFRS S1 requirements
   */
  getRequirements(): IFRSRequirement[] {
    return this.s1Requirements;
  }

  /**
   * Get requirement by code (e.g., "S1-1", "S1-2")
   */
  getRequirementByCode(code: string): IFRSRequirement | undefined {
    return this.s1Requirements.find(req => req.code === code || req.id === code);
  }

  /**
   * Get requirements by category
   */
  getRequirementsByCategory(category: 'governance' | 'strategy' | 'risk' | 'metrics'): IFRSRequirement[] {
    return this.s1Requirements.filter(req => req.category === category);
  }

  /**
   * Map questions to IFRS S1 requirements based on requirement field
   */
  async mapQuestionsToRequirements(): Promise<RequirementMapping[]> {
    // Get all S1 questions from database
    const questions = await prisma.question.findMany({
      where: {
        ifrsStandard: 'S1',
        isActive: true,
      },
    });

    // Create mappings
    const mappings: Map<string, RequirementMapping> = new Map();

    // Initialize mappings for all requirements
    for (const requirement of this.s1Requirements) {
      mappings.set(requirement.id, {
        requirementId: requirement.id,
        requirement,
        questionIds: [],
        coverage: 0,
      });
    }

    // Map questions to requirements based on requirement field
    for (const question of questions) {
      if (question.requirement) {
        // Parse requirement code (e.g., "S1-1: Governance" -> "S1-1")
        const requirementCode = question.requirement.split(':')[0].trim();
        const requirement = this.getRequirementByCode(requirementCode);

        if (requirement) {
          const mapping = mappings.get(requirement.id);
          if (mapping) {
            mapping.questionIds.push(question.id);
          }
        }
      }
    }

    // Calculate coverage for each requirement
    // Coverage is based on number of questions mapped to requirement
    // More questions = better coverage (simplified heuristic)
    for (const mapping of mappings.values()) {
      const questionCount = mapping.questionIds.length;
      // Simple heuristic: 1 question = 20% coverage, 5+ questions = 100% coverage
      mapping.coverage = Math.min(100, questionCount * 20);
    }

    return Array.from(mappings.values());
  }

  /**
   * Get requirement mapping for a specific requirement code
   */
  async getRequirementMapping(requirementCode: string): Promise<RequirementMapping | null> {
    const requirement = this.getRequirementByCode(requirementCode);
    if (!requirement) {
      return null;
    }

    const questions = await prisma.question.findMany({
      where: {
        ifrsStandard: 'S1',
        requirement: { contains: requirementCode },
        isActive: true,
      },
    });

    const questionIds = questions.map(q => q.id);
    const coverage = Math.min(100, questionIds.length * 20);

    return {
      requirementId: requirement.id,
      requirement,
      questionIds,
      coverage,
    };
  }

  /**
   * Check compliance status for a requirement based on answers
   */
  async checkRequirementCompliance(
    requirementCode: string,
    answers: Array<{ questionId: string; value: string }>
  ): Promise<{
    requirement: IFRSRequirement;
    compliant: boolean;
    score: number; // 0-100
    answeredQuestions: number;
    totalQuestions: number;
  }> {
    const requirement = this.getRequirementByCode(requirementCode);
    if (!requirement) {
      throw new Error(`Requirement ${requirementCode} not found`);
    }

    const mapping = await this.getRequirementMapping(requirementCode);
    if (!mapping) {
      return {
        requirement,
        compliant: false,
        score: 0,
        answeredQuestions: 0,
        totalQuestions: 0,
      };
    }

    // Check which questions have been answered
    const answerMap = new Map(answers.map(a => [a.questionId, a.value]));
    const answeredQuestions = mapping.questionIds.filter(id => answerMap.has(id)).length;
    const totalQuestions = mapping.questionIds.length;

    // Calculate compliance score
    // Simple heuristic: all questions answered with positive responses = compliant
    let positiveAnswers = 0;
    for (const questionId of mapping.questionIds) {
      const answer = answerMap.get(questionId);
      if (answer) {
        // Simple check: "yes", "yes", or longer text answers = positive
        const normalized = answer.toLowerCase().trim();
        if (normalized === 'yes' || normalized === 'y' || normalized === 'true' || answer.length > 20) {
          positiveAnswers++;
        }
      }
    }

    const score = totalQuestions > 0 ? (positiveAnswers / totalQuestions) * 100 : 0;
    const compliant = score >= 70; // 70% threshold for compliance

    return {
      requirement,
      compliant,
      score,
      answeredQuestions,
      totalQuestions,
    };
  }
}
