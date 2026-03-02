/**
 * Shared scoring constants and mapping rules for IFRS S1/S2 assessments.
 * Used by inChatScoringService and completion summary.
 */

export const GAP_THRESHOLD = 50;

export const READINESS_BANDS: ReadonlyArray<{ min: number; max: number; label: string }> = [
  { min: 80, max: 100, label: 'Ready' },
  { min: 60, max: 79, label: 'Developing' },
  { min: 40, max: 59, label: 'Early stage' },
  { min: 20, max: 39, label: 'Getting started' },
  { min: 0, max: 19, label: 'Not started' },
] as const;

/** Scale 1–5 maps to 0%, 25%, 50%, 75%, 100%. */
export const SCALE_SCORES: Readonly<Record<number, number>> = {
  1: 0,
  2: 25,
  3: 50,
  4: 75,
  5: 100,
};

/** MC option index fallback when option has no score: [100, 75, 50, 25, 0]. */
export const MC_INDEX_FALLBACK_SCORES: readonly number[] = [100, 75, 50, 25, 0];

export type ReadinessBandLabel = (typeof READINESS_BANDS)[number]['label'];

export function getReadinessBand(overallPercentage: number): ReadinessBandLabel | 'Unknown' {
  const band = READINESS_BANDS.find(
    (b) => overallPercentage >= b.min && overallPercentage <= b.max
  );
  return band?.label ?? 'Unknown';
}

export function getScaleScore(value: number): number {
  if (value >= 1 && value <= 5) return SCALE_SCORES[value as 1 | 2 | 3 | 4 | 5] ?? 0;
  return 0;
}
