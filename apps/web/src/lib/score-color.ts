import type { ScoreLabel } from "@hf-conditions/shared";

// SPEC.md §5/§28: color is a secondary cue only - every cell also shows its
// numerical score and label as text (SPEC.md §4 "Do not rely on color
// alone").
const SCORE_COLORS: Readonly<Record<ScoreLabel, string>> = {
  "Very Poor": "#b3261e",
  Poor: "#c8641e",
  Fair: "#b8960f",
  Good: "#3a8f4f",
  Excellent: "#1a7a3c",
};

export function scoreColor(label: ScoreLabel): string {
  return SCORE_COLORS[label];
}
