import type { PropagationSpot, SpotAggregateBucket } from "@hf-conditions/shared";
import type { LatLon } from "../geo/lat-lon.js";
import type { RegionResolver } from "../region/region-resolver.js";
import { directionWeight, localityWeight } from "../weighting.js";
import { resolveSpotLocality } from "./spot-locality.js";

// SPEC.md §7.2/§25: "Create aggregated five-minute buckets for longer
// analysis." Recency weighting is deliberately NOT baked in here - a
// bucket's age (and therefore its recency weight) keeps changing after it's
// written, so recency is applied later, at read/score time
// (summarizeRecentAggregates), not frozen in at collection time.
export const AGGREGATE_BUCKET_MINUTES = 5;

export function bucketWindowForTimestamp(
  isoTimestamp: string,
  bucketMinutes: number = AGGREGATE_BUCKET_MINUTES,
): { bucketStart: string; bucketEnd: string } {
  const bucketMs = bucketMinutes * 60 * 1000;
  const startMs = Math.floor(new Date(isoTimestamp).getTime() / bucketMs) * bucketMs;
  return {
    bucketStart: new Date(startMs).toISOString(),
    bucketEnd: new Date(startMs + bucketMs).toISOString(),
  };
}

export interface BucketSpotsInput {
  spots: readonly PropagationSpot[];
  qth: LatLon;
  regionResolver: RegionResolver;
  bucketMinutes?: number;
}

interface MutableBucket {
  bucketStart: string;
  bucketEnd: string;
  source: SpotAggregateBucket["source"];
  band: SpotAggregateBucket["band"];
  region: SpotAggregateBucket["region"];
  weightedSpotCount: number;
  uniqueStations: Set<string>;
  uniquePaths: Set<string>;
  snrSum: number;
  snrCount: number;
}

export function bucketSpots(input: BucketSpotsInput): SpotAggregateBucket[] {
  const groups = new Map<string, MutableBucket>();

  for (const spot of input.spots) {
    const locality = resolveSpotLocality(spot, input.qth);
    if (!locality) continue;

    const region = input.regionResolver.resolve(locality.remote);
    if (!region) continue;

    const { bucketStart, bucketEnd } = bucketWindowForTimestamp(spot.timestamp, input.bucketMinutes);
    const key = `${bucketStart}|${spot.source}|${spot.band}|${region}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        bucketStart,
        bucketEnd,
        source: spot.source,
        band: spot.band,
        region,
        weightedSpotCount: 0,
        uniqueStations: new Set(),
        uniquePaths: new Set(),
        snrSum: 0,
        snrCount: 0,
      };
      groups.set(key, group);
    }

    group.weightedSpotCount += localityWeight(locality.distanceKm) * directionWeight(locality.direction);
    // The "remote" call is whichever side isn't near the QTH - that's the
    // station providing independent evidence for this destination region.
    group.uniqueStations.add(locality.localSide === "tx" ? spot.rxCall : spot.txCall);
    group.uniquePaths.add(`${spot.txCall}|${spot.rxCall}`);
    if (spot.snr !== undefined) {
      group.snrSum += spot.snr;
      group.snrCount += 1;
    }
  }

  return Array.from(groups.values()).map((group) => ({
    bucketStart: group.bucketStart,
    bucketEnd: group.bucketEnd,
    source: group.source,
    band: group.band,
    region: group.region,
    weightedSpotCount: group.weightedSpotCount,
    uniqueStationCount: group.uniqueStations.size,
    uniquePathCount: group.uniquePaths.size,
    averageSnr: group.snrCount > 0 ? group.snrSum / group.snrCount : undefined,
  }));
}
