import { describe, expect, it } from "vitest";
import type { SpotAggregateBucket } from "@hf-conditions/shared";
import { mergeLivePskReporterBuckets } from "./live-pskreporter-evidence.js";

function bucket(overrides: Partial<SpotAggregateBucket> = {}): SpotAggregateBucket {
  return {
    bucketStart: "2026-08-21T00:00:00.000Z",
    bucketEnd: "2026-08-21T00:05:00.000Z",
    source: "pskReporter",
    band: "20m",
    region: "EUROPE",
    weightedSpotCount: 1,
    uniqueStationCount: 1,
    uniquePathCount: 1,
    ...overrides,
  };
}

describe("mergeLivePskReporterBuckets", () => {
  it("keeps the static snapshot untouched when the live query never resolved", () => {
    const staticBuckets = [bucket({ source: "pskReporter" }), bucket({ source: "rbn" })];
    expect(mergeLivePskReporterBuckets(staticBuckets, null)).toEqual(staticBuckets);
  });

  it("replaces only the pskReporter buckets with the live ones, leaving other sources untouched", () => {
    const staticBuckets = [
      bucket({ source: "pskReporter", region: "EUROPE" }),
      bucket({ source: "rbn", region: "ASIA" }),
      bucket({ source: "dxCluster", region: "NORTH_AMERICA" }),
    ];
    const liveBuckets = [bucket({ source: "pskReporter", region: "NORTH_AMERICA" })];

    const merged = mergeLivePskReporterBuckets(staticBuckets, liveBuckets);

    expect(merged).toHaveLength(3);
    expect(merged.filter((b) => b.source === "pskReporter")).toEqual(liveBuckets);
    expect(merged.filter((b) => b.source === "rbn")).toHaveLength(1);
    expect(merged.filter((b) => b.source === "dxCluster")).toHaveLength(1);
  });

  it("drops all static pskReporter buckets when the live query succeeded but found nothing", () => {
    const staticBuckets = [bucket({ source: "pskReporter" }), bucket({ source: "rbn" })];
    const merged = mergeLivePskReporterBuckets(staticBuckets, []);
    expect(merged.filter((b) => b.source === "pskReporter")).toHaveLength(0);
    expect(merged.filter((b) => b.source === "rbn")).toHaveLength(1);
  });
});
