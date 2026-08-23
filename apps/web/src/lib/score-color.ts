import type { ScoreLabel } from "@hf-conditions/shared";

// SPEC.md §5/§28: color is a secondary cue only - every cell also shows its
// numerical score and label as text (SPEC.md §4 "Do not rely on color
// alone").
//
// Palette runs along a single red -> orange -> green axis so status reads
// unambiguously at a glance, with each step visually distinct (not shades
// of the same hue) and saturated enough to stay legible as a border/tint
// in both light and dark mode.
const SCORE_COLORS: Readonly<Record<ScoreLabel, string>> = {
  "Very Poor": "#d32f2f",
  Poor: "#e2622c",
  Fair: "#f2a900",
  Good: "#7cb342",
  Excellent: "#2e7d32",
};

export function scoreColor(label: ScoreLabel): string {
  return SCORE_COLORS[label];
}

// Low-alpha wash of the same color, for a background tint alongside the
// solid border - reinforces the signal without relying on the border alone.
export function scoreBackground(label: ScoreLabel): string {
  return `${SCORE_COLORS[label]}26`;
}
