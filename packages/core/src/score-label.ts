import type { ScoreLabel } from "@hf-conditions/shared";

// SPEC.md §5
export function scoreLabel(score: number): ScoreLabel {
  if (score <= 19) return "Very Poor";
  if (score <= 39) return "Poor";
  if (score <= 59) return "Fair";
  if (score <= 79) return "Good";
  return "Excellent";
}
