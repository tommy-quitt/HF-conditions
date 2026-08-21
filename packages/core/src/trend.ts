import type { Trend } from "@hf-conditions/shared";

// SPEC.md §21: trend compares the current score with the score 15 minutes
// ago. Returns null (never a fabricated "stable") until enough history
// exists.
export const TREND_IMPROVING_THRESHOLD = 7;
export const TREND_DETERIORATING_THRESHOLD = -7;

export function trend(currentScore: number, previousScore: number | null): Trend | null {
  if (previousScore === null) return null;

  const delta = currentScore - previousScore;
  if (delta >= TREND_IMPROVING_THRESHOLD) return "improving";
  if (delta <= TREND_DETERIORATING_THRESHOLD) return "deteriorating";
  return "stable";
}
