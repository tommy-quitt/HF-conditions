import type { Band, Region, SpotAggregateBucket, SpotSource } from "@hf-conditions/shared";
import { RECENCY_MAX_AGE_MINUTES, recencyWeight } from "../weighting.js";

// Combines however many recent 5-minute buckets exist for one
// source/band/region into the inputs evidence.ts and confidence.ts need,
// applying recency weighting fresh (bucket age keeps changing after the
// bucket was written, so this can't be precomputed - see bucket-spots.ts).
export interface AggregateEvidenceSummary {
  weightedSpotCount: number;
  uniqueStationCount: number;
  uniquePathCount: number;
  averageSnr?: number;
  freshnessMinutes: number;
}

export interface SummarizeAggregateEvidenceFilter {
  source: SpotSource;
  band: Band;
  region: Region;
}

export function summarizeRecentAggregates(
  buckets: readonly SpotAggregateBucket[],
  filter: SummarizeAggregateEvidenceFilter,
  now: Date,
): AggregateEvidenceSummary | null {
  let weightedSpotCount = 0;
  // uniqueStationCount/uniquePathCount take the max across matching buckets
  // rather than summing - summing would double-count a station seen in
  // multiple 5-minute windows, which a simple max avoids at the cost of
  // slightly understating diversity across a long, very active window.
  let uniqueStationCount = 0;
  let uniquePathCount = 0;
  let snrSum = 0;
  let snrCount = 0;
  let freshestAgeMinutes = Infinity;

  for (const bucket of buckets) {
    if (bucket.source !== filter.source || bucket.band !== filter.band || bucket.region !== filter.region) continue;

    const ageMinutes = Math.max((now.getTime() - new Date(bucket.bucketEnd).getTime()) / 60_000, 0);
    if (ageMinutes > RECENCY_MAX_AGE_MINUTES) continue;

    weightedSpotCount += bucket.weightedSpotCount * recencyWeight(ageMinutes);
    uniqueStationCount = Math.max(uniqueStationCount, bucket.uniqueStationCount);
    uniquePathCount = Math.max(uniquePathCount, bucket.uniquePathCount);
    if (bucket.averageSnr !== undefined) {
      snrSum += bucket.averageSnr;
      snrCount += 1;
    }
    freshestAgeMinutes = Math.min(freshestAgeMinutes, ageMinutes);
  }

  if (freshestAgeMinutes === Infinity) return null;

  return {
    weightedSpotCount,
    uniqueStationCount,
    uniquePathCount,
    averageSnr: snrCount > 0 ? snrSum / snrCount : undefined,
    freshnessMinutes: freshestAgeMinutes,
  };
}
