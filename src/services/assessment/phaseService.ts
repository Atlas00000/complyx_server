/**
 * Phase Service
 * Manages different assessment modes and phases
 */

import type { AssessmentContext } from './assessmentFlowEngine';

export type AssessmentMode = 'quick-scan' | 'standard' | 'deep-dive' | 'continuous-monitoring';

export interface AssessmentModeConfig {
  mode: AssessmentMode;
  name: string;
  description: string;
  estimatedDuration: number; // minutes
  questionCount: {
    min: number;
    max: number;
    target: number;
  };
  focusAreas: string[];
  depth: 'surface' | 'moderate' | 'comprehensive';
  includeFollowUp: boolean;
}

export interface PhaseConfig {
  phase: 'initiation' | 'exploration' | 'assessment' | 'completion';
  name: string;
  description: string;
  questionsPerPhase?: number;
  timeLimit?: number; // minutes
}

/**
 * Phase Service
 * Handles assessment modes and phase management
 */
export class PhaseService {
  private modeConfigs: Map<AssessmentMode, AssessmentModeConfig> = new Map();

  constructor() {
    this.initializeModeConfigs();
  }

  /**
   * Initialize assessment mode configurations
   */
  private initializeModeConfigs(): void {
    // Quick Scan Mode (5-10 min)
    this.modeConfigs.set('quick-scan', {
      mode: 'quick-scan',
      name: 'Quick Scan',
      description: 'Rapid assessment to identify key compliance gaps (5-10 minutes)',
      estimatedDuration: 7,
      questionCount: {
        min: 10,
        max: 20,
        target: 15,
      },
      focusAreas: ['Governance', 'Strategy', 'Risk Management'],
      depth: 'surface',
      includeFollowUp: false,
    });

    // Standard Assessment Mode (30-45 min)
    this.modeConfigs.set('standard', {
      mode: 'standard',
      name: 'Standard Assessment',
      description: 'Comprehensive assessment covering all key areas (30-45 minutes)',
      estimatedDuration: 37,
      questionCount: {
        min: 40,
        max: 60,
        target: 50,
      },
      focusAreas: ['Governance', 'Strategy', 'Risk Management', 'Metrics', 'Targets'],
      depth: 'moderate',
      includeFollowUp: true,
    });

    // Deep Dive Mode (60+ min)
    this.modeConfigs.set('deep-dive', {
      mode: 'deep-dive',
      name: 'Deep Dive Assessment',
      description: 'Thorough assessment with detailed analysis (60+ minutes)',
      estimatedDuration: 90,
      questionCount: {
        min: 80,
        max: 120,
        target: 100,
      },
      focusAreas: [
        'Governance',
        'Strategy',
        'Risk Management',
        'Metrics',
        'Targets',
        'Value Chain',
        'Stakeholder Engagement',
        'Reporting',
      ],
      depth: 'comprehensive',
      includeFollowUp: true,
    });

    // Continuous Monitoring Mode
    this.modeConfigs.set('continuous-monitoring', {
      mode: 'continuous-monitoring',
      name: 'Continuous Monitoring',
      description: 'Ongoing assessment with periodic check-ins',
      estimatedDuration: 15, // Per check-in
      questionCount: {
        min: 5,
        max: 15,
        target: 10,
      },
      focusAreas: ['Progress Tracking', 'Change Detection', 'Gap Monitoring'],
      depth: 'surface',
      includeFollowUp: false,
    });
  }

  /**
   * Get mode configuration
   */
  getModeConfig(mode: AssessmentMode): AssessmentModeConfig {
    const config = this.modeConfigs.get(mode);
    if (!config) {
      throw new Error(`Unknown assessment mode: ${mode}`);
    }
    return config;
  }

  /**
   * Get all available modes
   */
  getAvailableModes(): AssessmentModeConfig[] {
    return Array.from(this.modeConfigs.values());
  }

  /**
   * Determine appropriate mode based on requirements
   */
  recommendMode(options: {
    timeAvailable?: number; // minutes
    depthRequired?: 'surface' | 'moderate' | 'comprehensive';
    focusAreas?: string[];
  }): AssessmentMode {
    const { timeAvailable, depthRequired, focusAreas } = options;

    // If time is very limited
    if (timeAvailable && timeAvailable < 15) {
      return 'quick-scan';
    }

    // If comprehensive depth required
    if (depthRequired === 'comprehensive') {
      return 'deep-dive';
    }

    // If many focus areas
    if (focusAreas && focusAreas.length > 5) {
      return 'deep-dive';
    }

    // Default to standard
    return 'standard';
  }

  /**
   * Get phase configuration
   */
  getPhaseConfig(phase: AssessmentContext['phase']): PhaseConfig {
    const configs: Record<AssessmentContext['phase'], PhaseConfig> = {
      initiation: {
        phase: 'initiation',
        name: 'Initiation',
        description: 'Assessment setup and initial questions',
        questionsPerPhase: 3,
        timeLimit: 5,
      },
      exploration: {
        phase: 'exploration',
        name: 'Exploration',
        description: 'Broad exploration of compliance areas',
        questionsPerPhase: 10,
        timeLimit: 15,
      },
      assessment: {
        phase: 'assessment',
        name: 'Assessment',
        description: 'Detailed assessment questions',
        questionsPerPhase: undefined, // Varies by mode
        timeLimit: undefined, // Varies by mode
      },
      completion: {
        phase: 'completion',
        name: 'Completion',
        description: 'Assessment summary and recommendations',
        questionsPerPhase: 0,
        timeLimit: 5,
      },
    };

    return configs[phase];
  }

  /**
   * Get questions for specific mode
   */
  getQuestionsForMode(
    mode: AssessmentMode,
    _ifrsStandard: 'S1' | 'S2' | 'both'
  ): {
    categories: string[];
    priority: 'high' | 'medium' | 'low';
    count: number;
  } {
    const config = this.getModeConfig(mode);

    // Determine question priority based on mode
    let priority: 'high' | 'medium' | 'low';
    if (mode === 'quick-scan') {
      priority = 'high'; // Only high priority in quick scan
    } else if (mode === 'deep-dive') {
      priority = 'low'; // Include all priorities in deep dive
    } else {
      priority = 'medium'; // Medium and high in standard
    }

    return {
      categories: config.focusAreas,
      priority,
      count: config.questionCount.target,
    };
  }

  /**
   * Calculate progress based on mode
   */
  calculateProgress(context: AssessmentContext): {
    percentage: number;
    questionsAnswered: number;
    totalQuestions: number;
    estimatedTimeRemaining: number; // minutes
  } {
    const config = this.getModeConfig(context.mode);
    const questionsAnswered = context.answeredQuestions.size;
    const totalQuestions = config.questionCount.target;

    const percentage = Math.min(100, Math.round((questionsAnswered / totalQuestions) * 100));

    // Estimate time remaining
    (Date.now() - context.startedAt.getTime()) / (1000 * 60);
    const avgTimePerQuestion = config.estimatedDuration / totalQuestions;
    const estimatedTimeRemaining = Math.max(0, (totalQuestions - questionsAnswered) * avgTimePerQuestion);

    return {
      percentage,
      questionsAnswered,
      totalQuestions,
      estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
    };
  }

  /**
   * Check if assessment should transition to next phase
   */
  shouldTransitionPhase(context: AssessmentContext): {
    shouldTransition: boolean;
    nextPhase?: AssessmentContext['phase'];
    reason?: string;
  } {
    const currentPhase = context.phase;
    const progress = this.calculateProgress(context);

    // Initiation -> Exploration
    if (currentPhase === 'initiation' && context.answeredQuestions.size >= 3) {
      return {
        shouldTransition: true,
        nextPhase: 'exploration',
        reason: 'Initial questions completed',
      };
    }

    // Exploration -> Assessment
    if (currentPhase === 'exploration' && context.answeredQuestions.size >= 10) {
      return {
        shouldTransition: true,
        nextPhase: 'assessment',
        reason: 'Exploration phase completed',
      };
    }

    // Assessment -> Completion
    if (currentPhase === 'assessment' && progress.percentage >= 100) {
      return {
        shouldTransition: true,
        nextPhase: 'completion',
        reason: 'All questions answered',
      };
    }

    return {
      shouldTransition: false,
    };
  }

  /**
   * Get mode-specific question filters
   */
  getModeFilters(mode: AssessmentMode): {
    priority?: 'high' | 'medium' | 'low';
    categories?: string[];
    maxQuestions?: number;
  } {
    const config = this.getModeConfig(mode);

    const filters: {
      priority?: 'high' | 'medium' | 'low';
      categories?: string[];
      maxQuestions?: number;
    } = {
      maxQuestions: config.questionCount.target,
    };

    // Set priority filter based on mode
    if (mode === 'quick-scan') {
      filters.priority = 'high';
    } else if (mode === 'standard') {
      // Include high and medium
      // Priority filter handled separately
    } else if (mode === 'deep-dive') {
      // Include all priorities
    }

    // Set categories based on focus areas
    filters.categories = config.focusAreas;

    return filters;
  }

  /**
   * Validate mode selection
   */
  validateModeSelection(
    _mode: AssessmentMode,
    _ifrsStandard: 'S1' | 'S2' | 'both'
  ): {
    valid: boolean;
    error?: string;
  } {
    // All modes are valid for all standards
    // Could add mode-specific validation here
    return {
      valid: true,
    };
  }

  /**
   * Get assessment summary by mode
   */
  getModeSummary(context: AssessmentContext): {
    mode: AssessmentMode;
    config: AssessmentModeConfig;
    progress: ReturnType<PhaseService['calculateProgress']>;
    phase: PhaseConfig;
    nextPhase?: PhaseConfig;
  } {
    const config = this.getModeConfig(context.mode);
    const progress = this.calculateProgress(context);
    const phase = this.getPhaseConfig(context.phase);
    const transition = this.shouldTransitionPhase(context);

    return {
      mode: context.mode,
      config,
      progress,
      phase,
      nextPhase: transition.nextPhase ? this.getPhaseConfig(transition.nextPhase) : undefined,
    };
  }
}
