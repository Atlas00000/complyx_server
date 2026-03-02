import { prisma } from '../../utils/db';
import { getCompletionSummary } from './assessmentCompletionService';

/**
 * Build a short text block describing the user's latest assessment for chat context.
 * Returns null if user has no completed assessment.
 */
export async function getAssessmentSummaryForUser(
  userId: string
): Promise<string | null> {
  const latest = await prisma.assessment.findFirst({
    where: { userId, status: 'completed' },
    orderBy: { completedAt: 'desc' },
    select: { id: true },
  });

  if (!latest) return null;

  const summary = await getCompletionSummary(latest.id);
  if (!summary) return null;

  const lines: string[] = [
    'User has completed an IFRS S1/S2 readiness assessment. Use this to personalize answers when relevant.',
    `Overall readiness: ${summary.overallPercentage}% (${summary.readinessBand}).`,
  ];

  if (summary.categoryScores.length > 0) {
    lines.push(
      'By pillar: ' +
        summary.categoryScores.map((c) => `${c.category} ${c.percentage}%`).join(', ')
    );
  }

  if (summary.gaps.length > 0) {
    const gapCategories = [...new Set(summary.gaps.map((g) => g.category).filter(Boolean))];
    if (gapCategories.length > 0) {
      lines.push(`Areas to improve (below 50%): ${gapCategories.join(', ')}.`);
    } else {
      lines.push(`${summary.gaps.length} question(s) need attention.`);
    }
  }

  return lines.join('\n');
}
