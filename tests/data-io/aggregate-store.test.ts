import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendAggregateBuckets, readAggregateBuckets } from "@hf-conditions/data-io";
import type { SpotAggregateBucket } from "@hf-conditions/shared";

function makeBucket(overrides: Partial<SpotAggregateBucket> = {}): SpotAggregateBucket {
  return {
    bucketStart: "2026-08-20T12:00:00.000Z",
    bucketEnd: "2026-08-20T12:05:00.000Z",
    source: "pskReporter",
    band: "20m",
    region: "EUROPE",
    weightedSpotCount: 3.2,
    uniqueStationCount: 2,
    uniquePathCount: 2,
    ...overrides,
  };
}

describe("aggregate-store", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "hf-conditions-aggregate-store-"));
    filePath = path.join(dir, "aggregates.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns an empty array when the file does not exist", async () => {
    expect(await readAggregateBuckets(filePath)).toEqual([]);
  });

  it("appends new buckets and reads them back", async () => {
    await appendAggregateBuckets(filePath, [makeBucket()], 60, new Date("2026-08-20T12:06:00.000Z"));
    const buckets = await readAggregateBuckets(filePath);
    expect(buckets).toHaveLength(1);
  });

  it("upserts a bucket with the same key instead of duplicating it", async () => {
    const now = new Date("2026-08-20T12:06:00.000Z");
    await appendAggregateBuckets(filePath, [makeBucket({ weightedSpotCount: 1 })], 60, now);
    await appendAggregateBuckets(filePath, [makeBucket({ weightedSpotCount: 5 })], 60, now);

    const buckets = await readAggregateBuckets(filePath);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.weightedSpotCount).toBe(5);
  });

  it("prunes buckets older than the retention window", async () => {
    const now = new Date("2026-08-20T14:00:00.000Z"); // ~2 hours after the bucket above
    await appendAggregateBuckets(filePath, [makeBucket()], 60, new Date("2026-08-20T12:06:00.000Z"));
    await appendAggregateBuckets(filePath, [], 60, now);

    expect(await readAggregateBuckets(filePath)).toEqual([]);
  });
});
