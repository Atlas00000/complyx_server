import { QuestionService, QuestionWithCategory } from './questionService';

export interface PhaseInfo {
  phase: 'quick' | 'detailed' | 'followup';
  name: string;
  description: string;
  questionCount: number;
  estimatedTime: string;
}

export class PhaseService {
  private questionService: QuestionService;

  constructor(questionService?: QuestionService) {
    this.questionService = questionService || new QuestionService();
  }

  /**
   * Get information about all phases
   */
  async getPhaseInfo(ifrsStandard?: 'S1' | 'S2'): Promise<PhaseInfo[]> {
    const quickQuestions = await this.questionService.getQuestionsByPhase('quick', ifrsStandard);
    const detailedQuestions = await this.questionService.getQuestionsByPhase('detailed', ifrsStandard);
    const followupQuestions = await this.questionService.getQuestionsByPhase('followup', ifrsStandard);

    return [
      {
        phase: 'quick',
        name: 'Quick Assessment',
        description: '10 essential questions to get a baseline score (5-10 minutes)',
        questionCount: quickQuestions.length,
        estimatedTime: '5-10 minutes',
      },
      {
        phase: 'detailed',
        name: 'Detailed Assessment',
        description: 'Comprehensive questions for in-depth analysis (20-30 minutes)',
        questionCount: detailedQuestions.length,
        estimatedTime: '20-30 minutes',
      },
      {
        phase: 'followup',
        name: 'Follow-up Questions',
        description: 'Targeted questions based on gaps identified (10-15 minutes)',
        questionCount: followupQuestions.length,
        estimatedTime: '10-15 minutes',
      },
    ];
  }

  /**
   * Get questions for a specific phase
   */
  async getPhaseQuestions(phase: 'quick' | 'detailed' | 'followup', ifrsStandard?: 'S1' | 'S2'): Promise<QuestionWithCategory[]> {
    return this.questionService.getQuestionsByPhase(phase, ifrsStandard);
  }

  /**
   * Check if a phase is complete
   */
  async isPhaseComplete(
    phase: 'quick' | 'detailed' | 'followup',
    answeredQuestionIds: Set<string>,
    ifrsStandard?: 'S1' | 'S2'
  ): Promise<boolean> {
    const phaseQuestions = await this.getPhaseQuestions(phase, ifrsStandard);
    const phaseQuestionIds = new Set(phaseQuestions.map(q => q.id));
    
    // Check if all phase questions are answered
    for (const questionId of phaseQuestionIds) {
      if (!answeredQuestionIds.has(questionId)) {
        return false;
      }
    }
    
    return true;
  }
}
