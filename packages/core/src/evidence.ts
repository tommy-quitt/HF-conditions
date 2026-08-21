// SPEC.md §13/§14: per-source evidence from weighted activity + diversity.
// PSKReporter/RBN and DX Cluster use the same combination formula (0.60
// activity + 0.40 diversity) with different saturation constants, so the
// combinator is shared.
function saturating(count: number, k: number): number {
  if (count <= 0) return 0;
  return 100 * (1 - Math.exp(-count / k));
}

export function activityScore(weightedCount: number, k: number): number {
  return saturating(weightedCount, k);
}

export function diversityScore(uniqueCount: number, k: number): number {
  return saturating(uniqueCount, k);
}

export function combineActivityAndDiversity(
  activity: number,
  diversity: number,
  activityWeight = 0.6,
  diversityWeight = 0.4,
): number {
  return activityWeight * activity + diversityWeight * diversity;
}

// SPEC.md §13: PSKReporter/RBN automated-reception evidence.
export function sourceEvidence(weightedSpotCount: number, uniquePathCount: number): number {
  return combineActivityAndDiversity(activityScore(weightedSpotCount, 8), diversityScore(uniquePathCount, 5));
}

// SPEC.md §14: DX Cluster human-reported evidence.
export function clusterEvidence(weightedSpots: number, uniqueStations: number): number {
  return combineActivityAndDiversity(activityScore(weightedSpots, 5), diversityScore(uniqueStations, 4));
}
