import { bucketSpots, createRegionResolver } from "@hf-conditions/core";
import type { Qth, SpotAggregateBucket } from "@hf-conditions/shared";
import { fetchLivePskReporterSpots } from "./adapters/pskreporter-live.js";

// EXPERIMENTAL - see DEVIATIONS.md. Matches the collector's own PSKReporter
// query window (scripts/collect.ts's PSK_REPORTER_WINDOW_MINUTES).
const LIVE_PSK_WINDOW_MINUTES = 15;

// DXCC table is intentionally empty everywhere in this project (TASKS.md
// step 3) - matches the same coordinate-only resolver scripts/collect.ts
// uses, so live and collector-sourced buckets classify regions identically.
const REGION_RESOLVER = createRegionResolver({ dxccTable: [] });

// Returns null (not []) when the live query didn't run/succeed, so callers
// can tell "queried, found nothing" apart from "didn't get a live answer at
// all" and fall back to the collector's static buckets instead of silently
// showing zero evidence (AGENTS.md: never treat a failed source as a zero
// score).
export async function fetchLivePskReporterBuckets(qth: Qth): Promise<SpotAggregateBucket[] | null> {
  if (!qth.grid) return null;
  const spots = await fetchLivePskReporterSpots({ grid: qth.grid, windowMinutes: LIVE_PSK_WINDOW_MINUTES });
  return bucketSpots({ spots, qth, regionResolver: REGION_RESOLVER });
}

// Replaces the collector's fixed-home-grid pskReporter buckets with ones
// computed against the viewer's own QTH; rbn/dxCluster buckets (already
// global, not grid-scoped - DEVIATIONS.md) pass through untouched.
export function mergeLivePskReporterBuckets(
  staticBuckets: readonly SpotAggregateBucket[],
  liveBuckets: readonly SpotAggregateBucket[] | null,
): SpotAggregateBucket[] {
  if (liveBuckets === null) return [...staticBuckets];
  return [...staticBuckets.filter((bucket) => bucket.source !== "pskReporter"), ...liveBuckets];
}
