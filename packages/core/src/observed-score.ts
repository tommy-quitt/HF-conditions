import type { SpotSource } from "@hf-conditions/shared";

// SPEC.md §15: General-mode observed-propagation score, blending the three
// source evidence scores. Weights are configuration, not constants baked
// into the formula.
export const DEFAULT_SOURCE_WEIGHTS: Readonly<Record<SpotSource, number>> = {
  pskReporter: 0.45,
  rbn: 0.35,
  dxCluster: 0.2,
};

export interface SourceEvidence {
  pskReporter: number | null;
  rbn: number | null;
  dxCluster: number | null;
}

// SPEC.md §15: "If a source is unavailable, renormalize the weights among
// the remaining sources" rather than treating it as zero. Returns null when
// every source is unavailable so callers can apply SPEC.md §19's no-data
// behavior instead of a fabricated zero.
export function observedScore(
  evidence: SourceEvidence,
  weights: Readonly<Record<SpotSource, number>> = DEFAULT_SOURCE_WEIGHTS,
): number | null {
  const available = (Object.entries(evidence) as [SpotSource, number | null][]).filter(
    (entry): entry is [SpotSource, number] => entry[1] !== null,
  );

  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, [source]) => sum + weights[source], 0);
  if (totalWeight <= 0) return null;

  const weightedSum = available.reduce((sum, [source, score]) => sum + weights[source] * score, 0);
  return weightedSum / totalWeight;
}
