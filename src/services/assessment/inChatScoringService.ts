import { prisma } from '../../utils/db';
import {
  GAP_THRESHOLD,
  getReadinessBand,
  getScaleScore,
  MC_INDEX_FALLBACK_SCORES,
} from './scoringConstants';

export interface CategoryScoreResult {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
}

export interface GapResult {
  type: 'category' | 'question';
  category?: string;
  questionId?: string;
  questionText?: string;
  score?: number;
  percentage?: number;
}

export interface InChatAssessmentScoreResult {
  assessmentId: string;
  overallPercentage: number;
  categoryScores: CategoryScoreResult[];
  gaps: GapResult[];
  readinessBand: string;
}

/**
 * Parse option score from stored value.
 * Skip / "I don't know" -> 0. Yes/No -> 100/0. Scale 1-5 -> 0/25/50/75/100. MC from option score or index fallback.
 */
function scoreValue(value: string, questionType: string, optionsJson: string | null): number {
  const v = String(value).trim().toLowerCase();

  if (v === 'skip' || v === 'skipped') return 0;

  if (questionType === 'yes_no') {
    if (v === 'yes' || v === 'y' || v === 'true') return 100;
    return 0;
  }

  if (questionType === 'scale') {
    const num = parseInt(v, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) return getScaleScore(num);
    return 0;
  }

  if (questionType === 'multiple_choice' && optionsJson) {
    try {
      const options = JSON.parse(optionsJson) as Array<{ value?: string; label?: string; score?: number }>;
      const option = options.find(
        (o) => String(o.value || o.label || '').trim().toLowerCase() === v
      );
      if (option != null && typeof option.score === 'number') return option.score;
      const idx = options.findIndex((o) => String(o.value || o.label || '').trim().toLowerCase() === v);
      if (idx >= 0) return MC_INDEX_FALLBACK_SCORES[Math.min(idx, 4)] ?? 50;
    } catch {
      // ignore
    }
    return 50;
  }

  return 0;
}

/**
 * Compute category scores, overall percentage, gaps, and readiness band for an in-chat assessment.
 */
export async function computeInChatScores(
  assessmentId: string
): Promise<InChatAssessmentScoreResult | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      answers: true,
    },
  });
  if (!assessment || assessment.status !== 'completed') return null;

  const questionIds = assessment.answers.map((a) => a.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { category: true },
  });
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const answersMap = new Map(assessment.answers.map((a) => [a.questionId, a.value]));

  const byCategory = new Map<
    string,
    { score: number; maxScore: number; count: number; questionScores: Array<{ qId: string; text: string; pct: number }> }
  >();

  for (const q of questions) {
    const cat = q.category.name;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { score: 0, maxScore: 0, count: 0, questionScores: [] });
    }
    const data = byCategory.get(cat)!;
    const value = answersMap.get(q.id);
    const maxScore = 100;
    const score = value != null ? scoreValue(value, q.type, q.options) : 0;
    data.score += score;
    data.maxScore += maxScore;
    data.count += 1;
    data.questionScores.push({
      qId: q.id,
      text: q.text,
      pct: value != null ? score : 0,
    });
  }

  const categoryScores: CategoryScoreResult[] = Array.from(byCategory.entries()).map(
    ([category, data]) => ({
      category,
      score: data.score,
      maxScore: data.maxScore,
      percentage: data.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0,
      questionCount: data.count,
    })
  );

  const totalScore = categoryScores.reduce((s, c) => s + c.score, 0);
  const totalMax = categoryScores.reduce((s, c) => s + c.maxScore, 0);
  const overallPercentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const gaps: GapResult[] = [];
  for (const cs of categoryScores) {
    if (cs.percentage < GAP_THRESHOLD) {
      gaps.push({ type: 'category', category: cs.category, percentage: cs.percentage });
    }
  }
  for (const [, data] of byCategory) {
    for (const qs of data.questionScores) {
      if (qs.pct < GAP_THRESHOLD) {
        const q = questionMap.get(qs.qId);
        gaps.push({
          type: 'question',
          questionId: qs.qId,
          questionText: q?.text?.slice(0, 80),
          category: q?.category?.name,
          percentage: qs.pct,
        });
      }
    }
  }

  const readinessBand = getReadinessBand(overallPercentage);

  return {
    assessmentId,
    overallPercentage,
    categoryScores,
    gaps,
    readinessBand,
  };
}
