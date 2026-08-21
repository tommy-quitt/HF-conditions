import { describe, expect, it } from "vitest";
import {
  bucketSpots,
  bucketWindowForTimestamp,
  createRegionResolver,
  resolveSpotLocality,
  summarizeRecentAggregates,
} from "@hf-conditions/core";
import type { PropagationSpot } from "@hf-conditions/shared";

const QTH = { lat: 32.1, lon: 34.8 }; // KM72

function makeSpot(overrides: Partial<PropagationSpot> = {}): PropagationSpot {
  return {
    id: "spot-1",
    timestamp: "2026-08-20T12:00:00.000Z",
    source: "pskReporter",
    band: "20m",
    frequencyKhz: 14074,
    mode: "FT8",
    txCall: "4X1ABC",
    rxCall: "DL1XYZ",
    txLat: 32.0,
    txLon: 34.9,
    rxLat: 51.0,
    rxLon: 10.0,
    isAutomated: true,
    ...overrides,
  };
}

describe("resolveSpotLocality", () => {
  it("picks the closer endpoint as local and classifies direction accordingly", () => {
    const locality = resolveSpotLocality(makeSpot(), QTH);
    expect(locality?.localSide).toBe("tx");
    expect(locality?.direction).toBe("outboundFromQth");
    expect(locality?.remote).toEqual({ lat: 51.0, lon: 10.0, dxccEntityCode: undefined });
  });

  it("returns null when neither endpoint is within range", () => {
    const spot = makeSpot({ txLat: -33.9, txLon: 151.2, rxLat: 51.0, rxLon: 10.0 }); // Sydney <-> Germany
    expect(resolveSpotLocality(spot, QTH)).toBeNull();
  });

  it("treats an inbound observation (remote -> QTH) with the discounted direction weight", () => {
    const spot = makeSpot({ txLat: 51.0, txLon: 10.0, rxLat: 32.0, rxLon: 34.9 });
    const locality = resolveSpotLocality(spot, QTH);
    expect(locality?.localSide).toBe("rx");
    expect(locality?.direction).toBe("inboundToQth");
  });
});

describe("bucketSpots", () => {
  const regionResolver = createRegionResolver();

  it("groups spots into a five-minute bucket keyed by source/band/region", () => {
    const buckets = bucketSpots({ spots: [makeSpot()], qth: QTH, regionResolver });
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ source: "pskReporter", band: "20m", region: "EUROPE" });
    expect(buckets[0]?.weightedSpotCount).toBeGreaterThan(0);
    expect(buckets[0]?.uniqueStationCount).toBe(1);
    expect(buckets[0]?.uniquePathCount).toBe(1);
  });

  it("drops a spot whose remote endpoint doesn't resolve to a supported region", () => {
    const spot = makeSpot({ rxLat: 0, rxLon: 20 }); // central Africa - not EUROPE/NA/ASIA
    expect(bucketSpots({ spots: [spot], qth: QTH, regionResolver })).toHaveLength(0);
  });

  it("merges multiple spots in the same window/source/band/region into one bucket", () => {
    const spots = [
      makeSpot({ id: "a", txCall: "4X1ABC", rxCall: "DL1AAA" }),
      makeSpot({ id: "b", txCall: "4X1ABC", rxCall: "DL1BBB" }),
    ];
    const buckets = bucketSpots({ spots, qth: QTH, regionResolver });
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.uniqueStationCount).toBe(2);
  });
});

describe("bucketWindowForTimestamp", () => {
  it("floors a timestamp to its containing 5-minute window", () => {
    expect(bucketWindowForTimestamp("2026-08-20T12:07:30.000Z")).toEqual({
      bucketStart: "2026-08-20T12:05:00.000Z",
      bucketEnd: "2026-08-20T12:10:00.000Z",
    });
  });
});

describe("summarizeRecentAggregates", () => {
  const filter = { source: "pskReporter" as const, band: "20m" as const, region: "EUROPE" as const };

  it("returns null when there are no matching buckets", () => {
    expect(summarizeRecentAggregates([], filter, new Date())).toBeNull();
  });

  it("applies recency weighting based on bucket age, not collection time", () => {
    const now = new Date("2026-08-20T12:20:00.000Z");
    const freshBucket = {
      bucketStart: "2026-08-20T12:15:00.000Z",
      bucketEnd: "2026-08-20T12:20:00.000Z",
      source: "pskReporter" as const,
      band: "20m" as const,
      region: "EUROPE" as const,
      weightedSpotCount: 10,
      uniqueStationCount: 5,
      uniquePathCount: 4,
    };
    const staleBucket = { ...freshBucket, bucketStart: "2026-08-20T11:00:00.000Z", bucketEnd: "2026-08-20T11:05:00.000Z" };

    const summary = summarizeRecentAggregates([freshBucket, staleBucket], filter, now);
    // The stale bucket is more than 60 minutes old and should be excluded entirely.
    expect(summary?.weightedSpotCount).toBeCloseTo(10, 4);
  });

  it("excludes buckets older than the 60-minute recency window", () => {
    const now = new Date("2026-08-20T13:00:00.000Z");
    const oldBucket = {
      bucketStart: "2026-08-20T11:00:00.000Z",
      bucketEnd: "2026-08-20T11:05:00.000Z",
      source: "pskReporter" as const,
      band: "20m" as const,
      region: "EUROPE" as const,
      weightedSpotCount: 10,
      uniqueStationCount: 5,
      uniquePathCount: 4,
    };
    expect(summarizeRecentAggregates([oldBucket], filter, now)).toBeNull();
  });
});
