import { prisma } from '../../utils/db';

export interface AnswerData {
  questionId: string;
  value: string;
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  answeredCount: number;
  totalCount: number;
}

export interface AssessmentScore {
  overallScore: number;
  overallPercentage: number;
  categoryScores: CategoryScore[];
  totalAnswered: number;
  totalQuestions: number;
}

/**
 * Scoring Service
 * Implements weighted scoring system and category-based scoring for IFRS assessments
 */
export class ScoringService {
  /**
   * Calculate score for a single answer based on question type
   */
  private calculateAnswerScore(answerValue: string, questionType: string, questionWeight: number): number {
    switch (questionType) {
      case 'yes_no':
        // Yes = 1.0, No = 0.0
        const normalized = answerValue.toLowerCase().trim();
        if (normalized === 'yes' || normalized === 'y' || normalized === 'true') {
          return questionWeight * 1.0;
        }
        return questionWeight * 0.0;

      case 'multiple_choice':
        // For now, all choices get equal weight
        // In future, can add scoring logic based on specific choice values
        return questionWeight * 0.5; // Neutral score for multiple choice

      case 'scale':
        // Parse numeric scale (e.g., 1-5, 1-10)
        const scaleValue = parseFloat(answerValue);
        if (!isNaN(scaleValue)) {
          // Normalize to 0-1 range (assuming 1-5 or 1-10 scale)
          const normalized = scaleValue <= 5 ? scaleValue / 5 : scaleValue / 10;
          return questionWeight * normalized;
        }
        return 0;

      case 'text':
        // Text answers get partial credit based on length and content
        // Simple heuristic: longer, more detailed answers get higher scores
        const textLength = answerValue.trim().length;
        if (textLength === 0) {
          return 0;
        }
        if (textLength < 50) {
          return questionWeight * 0.3; // Brief answer
        }
        if (textLength < 200) {
          return questionWeight * 0.6; // Moderate answer
        }
        return questionWeight * 0.9; // Detailed answer

      default:
        return 0;
    }
  }

  /**
   * Calculate scores for an assessment based on answers
   */
  async calculateAssessmentScore(
    answers: AnswerData[],
    ifrsStandard?: 'S1' | 'S2',
    phase?: 'quick' | 'detailed' | 'followup'
  ): Promise<AssessmentScore> {
    // Get all questions for the assessment
    const where: any = {};
    if (ifrsStandard) {
      where.ifrsStandard = ifrsStandard;
    }
    if (phase) {
      where.phase = phase;
    }

    const allQuestions = await prisma.question.findMany({
      where: {
        ...where,
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    // Create maps for efficient lookup
    const questionMap = new Map(allQuestions.map(q => [q.id, q]));
    const answersMap = new Map(answers.map(a => [a.questionId, a.value]));

    // Calculate category scores
    const categoryScoresMap = new Map<string, { score: number; maxScore: number; answered: number; total: number }>();

    // Initialize category scores
    for (const question of allQuestions) {
      const categoryName = question.category.name;
      if (!categoryScoresMap.has(categoryName)) {
        categoryScoresMap.set(categoryName, { score: 0, maxScore: 0, answered: 0, total: 0 });
      }
    }

    // Calculate scores for each question
    for (const question of allQuestions) {
      const categoryName = question.category.name;
      const categoryData = categoryScoresMap.get(categoryName)!;

      // Max possible score for this question
      const maxQuestionScore = question.weight;
      categoryData.maxScore += maxQuestionScore;
      categoryData.total += 1;

      // If answered, calculate score
      const answerValue = answersMap.get(question.id);
      if (answerValue !== undefined) {
        const questionScore = this.calculateAnswerScore(answerValue, question.type, question.weight);
        categoryData.score += questionScore;
        categoryData.answered += 1;
      }
    }

    // Convert to CategoryScore array
    const categoryScores: CategoryScore[] = Array.from(categoryScoresMap.entries()).map(([category, data]) => ({
      category,
      score: data.score,
      maxScore: data.maxScore,
      percentage: data.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0,
      answeredCount: data.answered,
      totalCount: data.total,
    }));

    // Calculate overall score
    const totalScore = categoryScores.reduce((sum, cs) => sum + cs.score, 0);
    const totalMaxScore = categoryScores.reduce((sum, cs) => sum + cs.maxScore, 0);
    const overallScore = totalScore;
    const overallPercentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    const totalAnswered = answers.length;
    const totalQuestions = allQuestions.length;

    return {
      overallScore,
      overallPercentage,
      categoryScores,
      totalAnswered,
      totalQuestions,
    };
  }

  /**
   * Calculate and save scores to database
   */
  async calculateAndSaveScores(
    assessmentId: string,
    answers: AnswerData[],
    ifrsStandard?: 'S1' | 'S2',
    phase?: 'quick' | 'detailed' | 'followup'
  ): Promise<AssessmentScore> {
    // Calculate scores
    const assessmentScore = await this.calculateAssessmentScore(answers, ifrsStandard, phase);

    // Save category scores to database
    // First, delete existing scores for this assessment
    await prisma.score.deleteMany({
      where: { assessmentId },
    });

    // Then create new scores
    for (const categoryScore of assessmentScore.categoryScores) {
      await prisma.score.create({
        data: {
          assessmentId,
          category: categoryScore.category,
          score: categoryScore.score,
          maxScore: categoryScore.maxScore,
        },
      });
    }

    return assessmentScore;
  }

  /**
   * Get scores for an assessment from database
   */
  async getAssessmentScores(assessmentId: string): Promise<CategoryScore[]> {
    const scores = await prisma.score.findMany({
      where: { assessmentId },
      orderBy: { category: 'asc' },
    });

    return scores.map(s => ({
      category: s.category,
      score: s.score,
      maxScore: s.maxScore,
      percentage: s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0,
      answeredCount: 0, // Would need additional query to calculate
      totalCount: 0, // Would need additional query to calculate
    }));
  }
}
