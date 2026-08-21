import { describe, expect, it } from "vitest";
import { computeConditionCell, computeConditions } from "@hf-conditions/core";
import type { SpotAggregateBucket } from "@hf-conditions/shared";

const QTH = { grid: "KM72", lat: 32.1, lon: 34.8 };
const NOW = new Date("2026-08-20T12:10:00.000Z");
const CALM_SOLAR = { f107: 120, kp: 1, observedAt: "2026-08-20T12:00:00.000Z" };

function bucket(overrides: Partial<SpotAggregateBucket>): SpotAggregateBucket {
  return {
    bucketStart: "2026-08-20T12:05:00.000Z",
    bucketEnd: "2026-08-20T12:10:00.000Z",
    source: "pskReporter",
    band: "20m",
    region: "EUROPE",
    weightedSpotCount: 0,
    uniqueStationCount: 0,
    uniquePathCount: 0,
    ...overrides,
  };
}

describe("computeConditionCell", () => {
  it("represents excellent live evidence with high confidence", () => {
    const buckets = [
      bucket({ source: "pskReporter", weightedSpotCount: 40, uniqueStationCount: 20, uniquePathCount: 20 }),
      bucket({ source: "rbn", weightedSpotCount: 30, uniqueStationCount: 15, uniquePathCount: 15 }),
      bucket({ source: "dxCluster", weightedSpotCount: 20, uniqueStationCount: 10, uniquePathCount: 10 }),
    ];
    const cell = computeConditionCell("20m", "EUROPE", { qth: QTH, solar: CALM_SOLAR, buckets, now: NOW });

    expect(cell.score).toBeGreaterThan(75);
    expect(cell.confidenceLabel).toBe("High");
    expect(cell.components.pskReporter).not.toBeNull();
    expect(cell.components.rbn).not.toBeNull();
    expect(cell.components.dxCluster).not.toBeNull();
  });

  it("represents weak evidence as a low score with low confidence", () => {
    const buckets = [
      bucket({
        source: "pskReporter",
        weightedSpotCount: 0.5,
        uniqueStationCount: 1,
        uniquePathCount: 1,
        // Sparse AND stale (near the 60-minute recency cutoff) - not just sparse.
        bucketStart: "2026-08-20T11:10:00.000Z",
        bucketEnd: "2026-08-20T11:15:00.000Z",
      }),
    ];
    const cell = computeConditionCell("20m", "EUROPE", { qth: QTH, solar: CALM_SOLAR, buckets, now: NOW });

    expect(cell.score).toBeLessThan(40);
    expect(cell.confidenceLabel).toBe("Low");
  });

  it("represents no evidence with a conservative score, observed baseline, and null components", () => {
    const cell = computeConditionCell("20m", "EUROPE", { qth: QTH, solar: CALM_SOLAR, buckets: [], now: NOW });

    expect(cell.score).toBeLessThanOrEqual(60);
    expect(cell.components.pskReporter).toBeNull();
    expect(cell.components.rbn).toBeNull();
    expect(cell.components.dxCluster).toBeNull();
    expect(cell.components.observed).toBe(40);
    expect(cell.confidenceLabel).toBe("Low");
  });

  it("renormalizes rather than zeroing a missing source", () => {
    const withAllThree = computeConditionCell("20m", "EUROPE", {
      qth: QTH,
      solar: CALM_SOLAR,
      buckets: [
        bucket({ source: "pskReporter", weightedSpotCount: 20, uniqueStationCount: 10, uniquePathCount: 10 }),
        bucket({ source: "rbn", weightedSpotCount: 20, uniqueStationCount: 10, uniquePathCount: 10 }),
      ],
      now: NOW,
    });
    const withOnlyPsk = computeConditionCell("20m", "EUROPE", {
      qth: QTH,
      solar: CALM_SOLAR,
      buckets: [bucket({ source: "pskReporter", weightedSpotCount: 20, uniqueStationCount: 10, uniquePathCount: 10 })],
      now: NOW,
    });

    // Equal evidence from the two available sources renormalizes to roughly
    // the same observed score as if only one had reported that same level.
    expect(Math.abs(withAllThree.components.observed - withOnlyPsk.components.observed)).toBeLessThan(1);
  });

  it("applies a high-Kp penalty on top of otherwise-strong evidence", () => {
    const buckets = [bucket({ source: "pskReporter", weightedSpotCount: 40, uniqueStationCount: 20, uniquePathCount: 20 })];
    const calm = computeConditionCell("20m", "EUROPE", { qth: QTH, solar: CALM_SOLAR, buckets, now: NOW });
    const stormy = computeConditionCell("20m", "EUROPE", {
      qth: QTH,
      solar: { ...CALM_SOLAR, kp: 7 },
      buckets,
      now: NOW,
    });

    expect(stormy.score).toBeLessThan(calm.score);
  });

  it("never calculates a trend (no history exists yet)", () => {
    const cell = computeConditionCell("20m", "EUROPE", { qth: QTH, solar: CALM_SOLAR, buckets: [], now: NOW });
    expect(cell.trend).toBeNull();
  });
});

describe("computeConditions", () => {
  it("produces one cell for every band/region combination", () => {
    const response = computeConditions({ qth: QTH, solar: CALM_SOLAR, buckets: [], now: NOW });
    expect(response.conditions).toHaveLength(10 * 3);
    expect(response.qth).toEqual(QTH);
  });
});
