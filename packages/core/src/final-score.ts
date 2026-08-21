// SPEC.md §18/§19: combine observed evidence with the solar/path modifiers,
// with a conservative environmental-only baseline when there is no evidence
// at all (never a fabricated 0).
export const FINAL_SCORE_MIN = 0;
export const FINAL_SCORE_MAX = 100;
export const NO_DATA_BASELINE_SCORE = 40;
export const NO_DATA_MAX_SCORE = 60;

export interface FinalScoreInput {
  observedScore: number | null;
  solarModifier: number;
  pathModifier: number;
}

export function finalScore(input: FinalScoreInput): number {
  if (input.observedScore === null) {
    const noDataScore = NO_DATA_BASELINE_SCORE + input.solarModifier + input.pathModifier;
    return Math.round(Math.min(Math.max(noDataScore, FINAL_SCORE_MIN), NO_DATA_MAX_SCORE));
  }

  const combined = input.observedScore + input.solarModifier + input.pathModifier;
  return Math.round(Math.min(Math.max(combined, FINAL_SCORE_MIN), FINAL_SCORE_MAX));
}
