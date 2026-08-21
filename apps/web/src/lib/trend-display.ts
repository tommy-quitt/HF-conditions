import type { Trend } from "@hf-conditions/shared";

// SPEC.md §21 display: a plain arrow/label per trend value. Score is still
// text-first (SPEC.md §4/§5) - this is a secondary cue alongside it.
export const TREND_ARROWS: Record<Trend, string> = {
  improving: "↑",
  deteriorating: "↓",
  stable: "→",
};

export const TREND_LABELS: Record<Trend, string> = {
  improving: "improving",
  deteriorating: "deteriorating",
  stable: "stable",
};
