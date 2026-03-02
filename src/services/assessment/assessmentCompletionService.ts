import { computeInChatScores } from './inChatScoringService';
import {
  buildCompletionSummaryText,
  getReadinessBandMessage,
  type CompletionScoresForPrompt,
} from '../ai/prompts/assessmentPrompt';
import type { InChatAssessmentScoreResult } from './inChatScoringService';

export interface CompletionSummaryResult {
  assessmentId: string;
  overallPercentage: number;
  readinessBand: string;
  readinessBandMessage?: string;
  categoryScores: Array<{ category: string; percentage: number; questionCount: number }>;
  gaps: Array<{ type: string; category?: string; questionText?: string; percentage?: number }>;
  summaryText: string;
}

/**
 * Get completion summary for a finished assessment: scores, gaps, readiness band, and summary text.
 * Returns null if assessment is not found or not completed.
 */
export async function getCompletionSummary(
  assessmentId: string
): Promise<CompletionSummaryResult | null> {
  const scores: InChatAssessmentScoreResult | null = await computeInChatScores(assessmentId);
  if (!scores) return null;

  const forPrompt: CompletionScoresForPrompt = {
    overallPercentage: scores.overallPercentage,
    readinessBand: scores.readinessBand,
    categoryScores: scores.categoryScores.map((c) => ({
      category: c.category,
      percentage: c.percentage,
      questionCount: c.questionCount,
    })),
    gapCategories: [...new Set(scores.gaps.filter((g) => g.category).map((g) => g.category!))],
    gapCount: scores.gaps.length,
  };

  const summaryText = buildCompletionSummaryText(forPrompt);

  return {
    assessmentId: scores.assessmentId,
    overallPercentage: scores.overallPercentage,
    readinessBand: scores.readinessBand,
    readinessBandMessage: getReadinessBandMessage(scores.readinessBand),
    categoryScores: forPrompt.categoryScores,
    gaps: scores.gaps.map((g) => ({
      type: g.type,
      category: g.category,
      questionText: g.questionText,
      percentage: g.percentage,
    })),
    summaryText,
  };
}
