export type AssessmentType = 'quick' | 'micro' | 'full';
export type MicroTopic = 'governance' | 'strategy' | 'risk' | 'metrics';

export interface CategoryScoreForPrompt {
  category: string;
  percentage: number;
  questionCount: number;
}

export interface CompletionScoresForPrompt {
  overallPercentage: number;
  readinessBand: string;
  categoryScores: CategoryScoreForPrompt[];
  gapCategories?: string[];
  gapCount?: number;
}

/**
 * Type-aware system prompt for assessment mode.
 * Use when the chat/AI is conducting an IFRS S1/S2 readiness assessment.
 */
export function getAssessmentSystemPrompt(
  assessmentType: AssessmentType,
  microTopic?: MicroTopic | null
): string {
  const typeLabel =
    assessmentType === 'quick'
      ? 'Quick (5–7 questions, ~5 min)'
      : assessmentType === 'micro' && microTopic
        ? `Micro – ${microTopic} (5 questions, ~3 min)`
        : 'Full (20 questions, ~15 min)';

  return `You are conducting an IFRS S1/S2 sustainability and climate readiness assessment. Assessment type: ${typeLabel}.

Guidelines:
- Ask one question at a time. Wait for the user's answer before proceeding.
- Do not repeat or rephrase the same question.
- If the user asks for clarification, provide a brief explanation and then repeat or continue with the question.
- Treat the user's reply as their answer to the current question; store it and move to the next.
- If the user says "skip" or "I don't know", record that and move to the next question.
- When all questions are answered, you will receive completion data (scores, gaps, readiness band). Summarize the results in 2–4 short sentences and congratulate them on completing the assessment.`;
}

/**
 * Build a plain-text completion summary from score results.
 * Can be shown in chat or used as context for an AI-generated summary later.
 */
export function buildCompletionSummaryText(scores: CompletionScoresForPrompt): string {
  const lines: string[] = [
    `**Assessment complete.** Overall readiness: **${scores.overallPercentage}%** (${scores.readinessBand}).`,
  ];
  if (scores.categoryScores.length > 0) {
    lines.push('');
    lines.push('By pillar:');
    for (const c of scores.categoryScores) {
      lines.push(`- ${c.category}: ${c.percentage}%`);
    }
  }
  if (scores.gapCategories && scores.gapCategories.length > 0) {
    lines.push('');
    lines.push(`Areas to improve (below 50%): ${scores.gapCategories.join(', ')}.`);
  } else if (scores.gapCount && scores.gapCount > 0) {
    lines.push('');
    lines.push(`${scores.gapCount} question(s) or pillar(s) need attention.`);
  }
  lines.push('');
  lines.push(getReadinessBandMessage(scores.readinessBand));
  return lines.join('\n');
}

/**
 * Prompt for AI to generate a short, friendly completion summary from score data.
 * Use when you want the AI to turn scores/gaps/readiness into a conversational message.
 */
export function getCompletionSummaryPrompt(scores: CompletionScoresForPrompt): string {
  const categoryLines = scores.categoryScores
    .map((c) => `- ${c.category}: ${c.percentage}%`)
    .join('\n');
  const gapNote =
    scores.gapCategories && scores.gapCategories.length > 0
      ? `Gaps (below 50%): ${scores.gapCategories.join(', ')}.`
      : 'No major gaps.';

  return `The user just completed an IFRS S1/S2 readiness assessment. Summarize the results in 2–4 short, friendly sentences.

Data:
- Overall: ${scores.overallPercentage}% (${scores.readinessBand})
- By pillar:
${categoryLines}
- ${gapNote}

Do not repeat raw numbers verbatim; highlight readiness band and 1–2 key strengths or areas to improve.`;
}

/** Short human-readable message for each readiness band (for completion summary). */
export function getReadinessBandMessage(band: string): string {
  const b = band.toLowerCase();
  if (b === 'ready') return 'Strong foundation for IFRS S1/S2 disclosure.';
  if (b === 'developing') return 'Good progress; focus on closing remaining gaps.';
  if (b === 'early stage') return 'Building blocks in place; consider a structured roadmap.';
  if (b === 'getting started') return 'Early stage—prioritize governance and data collection.';
  if (b === 'not started') return 'Starting point—we can help you build a plan.';
  return 'Review your results and focus on areas below 50%.';
}
