import type { ConfidenceLabel } from "@hf-conditions/shared";
import { RECENCY_HALF_LIFE_MINUTES } from "./weighting.js";

// SPEC.md §20: confidence considers source count, weighted observations,
// unique stations, freshness, and location validity - independent of the
// propagation score itself.
export interface ConfidenceInput {
  /** Count of sources (of pskReporter/rbn/dxCluster) that contributed evidence. */
  availableSourceCount: number;
  weightedReports: number;
  uniqueStations: number;
  /** Age of the freshest contributing observation; null when there is none. */
  freshnessMinutes: number | null;
  hasValidLocations: boolean;
}

const WEIGHTS = {
  sourceCoverage: 0.3,
  volume: 0.25,
  diversity: 0.2,
  freshness: 0.15,
  locationValidity: 0.1,
} as const;

const MAX_SOURCE_COUNT = 3;

function saturating(value: number, k: number): number {
  if (value <= 0) return 0;
  return 100 * (1 - Math.exp(-value / k));
}

function freshnessScore(freshnessMinutes: number | null): number {
  if (freshnessMinutes === null) return 0;
  if (freshnessMinutes <= 0) return 100;
  return 100 * Math.pow(0.5, freshnessMinutes / RECENCY_HALF_LIFE_MINUTES);
}

export function confidenceScore(input: ConfidenceInput): number {
  const sourceCoverage = (Math.min(Math.max(input.availableSourceCount, 0), MAX_SOURCE_COUNT) / MAX_SOURCE_COUNT) * 100;
  const volume = saturating(input.weightedReports, 10);
  const diversity = saturating(input.uniqueStations, 5);
  const freshness = freshnessScore(input.freshnessMinutes);
  const locationValidity = input.hasValidLocations ? 100 : 40;

  const combined =
    WEIGHTS.sourceCoverage * sourceCoverage +
    WEIGHTS.volume * volume +
    WEIGHTS.diversity * diversity +
    WEIGHTS.freshness * freshness +
    WEIGHTS.locationValidity * locationValidity;

  return Math.round(Math.min(Math.max(combined, 0), 100));
}

// SPEC.md §20 display table.
export function confidenceLabel(score: number): ConfidenceLabel {
  if (score <= 34) return "Low";
  if (score <= 69) return "Medium";
  return "High";
}
