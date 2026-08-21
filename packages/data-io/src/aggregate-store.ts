import type { SpotAggregateBucket } from "@hf-conditions/shared";
import { SpotAggregateBucketSchema } from "@hf-conditions/shared";
import { z } from "zod";
import { readJsonFile, writeJsonFile } from "./json-store.js";

const SpotAggregateBucketArraySchema = z.array(SpotAggregateBucketSchema);

export async function readAggregateBuckets(filePath: string): Promise<SpotAggregateBucket[]> {
  const buckets = await readJsonFile(filePath, SpotAggregateBucketArraySchema);
  return buckets ?? [];
}

// SPEC.md §6.2/§25: keep only enough bucket history to reconstruct the live
// evidence window (packages/core's RECENCY_MAX_AGE_MINUTES) - this file
// must never grow unbounded.
async function writeAggregateBuckets(
  filePath: string,
  buckets: readonly SpotAggregateBucket[],
  retainMinutes: number,
  now: Date,
): Promise<SpotAggregateBucket[]> {
  const cutoffMs = now.getTime() - retainMinutes * 60 * 1000;
  const pruned = buckets.filter((bucket) => new Date(bucket.bucketEnd).getTime() >= cutoffMs);
  await writeJsonFile(filePath, pruned, SpotAggregateBucketArraySchema);
  return pruned;
}

function bucketKey(bucket: SpotAggregateBucket): string {
  return `${bucket.bucketStart}|${bucket.source}|${bucket.band}|${bucket.region}`;
}

// Upserts by (bucketStart, source, band, region) so a re-run covering an
// overlapping time window updates that bucket instead of duplicating it,
// then prunes anything older than the retention window.
export async function appendAggregateBuckets(
  filePath: string,
  newBuckets: readonly SpotAggregateBucket[],
  retainMinutes: number,
  now: Date,
): Promise<SpotAggregateBucket[]> {
  const existing = await readAggregateBuckets(filePath);
  const merged = new Map(existing.map((bucket) => [bucketKey(bucket), bucket]));
  for (const bucket of newBuckets) {
    merged.set(bucketKey(bucket), bucket);
  }
  return writeAggregateBuckets(filePath, Array.from(merged.values()), retainMinutes, now);
}
