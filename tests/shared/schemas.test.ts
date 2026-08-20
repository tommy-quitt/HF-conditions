import { describe, expect, it } from "vitest";
import {
  BandSchema,
  ConditionCellSchema,
  ConditionsResponseSchema,
  DataSourceHealthSchema,
  HealthResponseSchema,
  MaidenheadGridSchema,
  PropagationSpotSchema,
  QthSchema,
  RegionSchema,
  SolarObservationSchema,
  SpotAggregateBucketSchema,
} from "@hf-conditions/shared";

describe("BandSchema", () => {
  it("accepts every supported band", () => {
    for (const band of ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m"]) {
      expect(BandSchema.parse(band)).toBe(band);
    }
  });

  it("rejects an unsupported band", () => {
    expect(() => BandSchema.parse("6m")).toThrow();
  });
});

describe("RegionSchema", () => {
  it("accepts the V1 destinations only", () => {
    expect(() => RegionSchema.parse("AFRICA")).toThrow();
    expect(RegionSchema.parse("EUROPE")).toBe("EUROPE");
  });
});

describe("MaidenheadGridSchema", () => {
  it("accepts a 4-character locator and normalizes case", () => {
    expect(MaidenheadGridSchema.parse("km72")).toBe("KM72");
  });

  it("accepts a 6-character locator", () => {
    expect(MaidenheadGridSchema.parse("KM72ab")).toBe("KM72AB");
  });

  it("accepts an 8-character locator", () => {
    expect(MaidenheadGridSchema.parse("KM72ab12")).toBe("KM72AB12");
  });

  it("rejects an invalid locator", () => {
    expect(() => MaidenheadGridSchema.parse("ZZ99")).toThrow();
    expect(() => MaidenheadGridSchema.parse("KM7")).toThrow();
    expect(() => MaidenheadGridSchema.parse("not-a-grid")).toThrow();
  });
});

describe("QthSchema", () => {
  it("accepts lat/lon without a grid", () => {
    expect(QthSchema.parse({ lat: 32.1, lon: 34.8 })).toEqual({ lat: 32.1, lon: 34.8 });
  });

  it("rejects out-of-range coordinates", () => {
    expect(() => QthSchema.parse({ lat: 132.1, lon: 34.8 })).toThrow();
  });
});

describe("SolarObservationSchema", () => {
  it("accepts the minimum required fields", () => {
    const parsed = SolarObservationSchema.parse({
      observedAt: "2026-08-20T12:00:00.000Z",
      f107: 132,
      kp: 2.3,
      source: "noaa",
    });
    expect(parsed.f107).toBe(132);
  });
});

describe("PropagationSpotSchema", () => {
  const base = {
    id: "abc123",
    timestamp: "2026-08-20T12:00:00.000Z",
    source: "pskReporter" as const,
    band: "20m" as const,
    frequencyKhz: 14074,
    mode: "FT8",
    txCall: "4X1ABC",
    rxCall: "DL1XYZ",
    isAutomated: true,
  };

  it("accepts a spot with only the required fields", () => {
    expect(PropagationSpotSchema.parse(base)).toMatchObject(base);
  });

  it("rejects an invalid locator instead of silently dropping it", () => {
    expect(() => PropagationSpotSchema.parse({ ...base, txGrid: "invalid" })).toThrow();
  });
});

describe("SpotAggregateBucketSchema", () => {
  it("accepts a five-minute bucket", () => {
    const bucket = {
      bucketStart: "2026-08-20T12:00:00.000Z",
      bucketEnd: "2026-08-20T12:05:00.000Z",
      source: "rbn" as const,
      band: "40m" as const,
      region: "EUROPE" as const,
      weightedSpotCount: 12.5,
      uniqueStationCount: 6,
      uniquePathCount: 5,
    };
    expect(SpotAggregateBucketSchema.parse(bucket)).toMatchObject(bucket);
  });
});

describe("ConditionCellSchema", () => {
  it("allows a source component to be null when that source is unavailable", () => {
    const cell = {
      band: "10m" as const,
      region: "ASIA" as const,
      score: 42,
      label: "Fair" as const,
      confidence: 25,
      confidenceLabel: "Low" as const,
      trend: null,
      components: {
        pskReporter: 55,
        rbn: null,
        dxCluster: null,
        observed: 55,
        solarModifier: 2,
        pathModifier: -1,
      },
      stats: { weightedReports: 3.2, uniqueStations: 2 },
    };
    expect(ConditionCellSchema.parse(cell).components.rbn).toBeNull();
  });

  it("rejects a score outside 0-100", () => {
    const cell = {
      band: "10m" as const,
      region: "ASIA" as const,
      score: 142,
      label: "Fair" as const,
      confidence: 25,
      confidenceLabel: "Low" as const,
      trend: null,
      components: {
        pskReporter: null,
        rbn: null,
        dxCluster: null,
        observed: 55,
        solarModifier: 2,
        pathModifier: -1,
      },
      stats: { weightedReports: 0, uniqueStations: 0 },
    };
    expect(() => ConditionCellSchema.parse(cell)).toThrow();
  });
});

describe("ConditionsResponseSchema", () => {
  it("validates the full SPEC.md §22 example shape", () => {
    const response = {
      qth: { grid: "KM72", lat: 32.0, lon: 34.0 },
      generatedAt: "2026-08-20T12:00:00.000Z",
      solar: { f107: 132, kp: 2.3, observedAt: "2026-08-20T11:55:00.000Z" },
      conditions: [
        {
          band: "20m",
          region: "EUROPE",
          score: 91,
          label: "Excellent",
          confidence: 88,
          confidenceLabel: "High",
          trend: "improving",
          components: {
            pskReporter: 92,
            rbn: 87,
            dxCluster: 72,
            observed: 86,
            solarModifier: 3,
            pathModifier: 2,
          },
          stats: { weightedReports: 127.4, uniqueStations: 39 },
        },
      ],
    };
    expect(ConditionsResponseSchema.parse(response).qth.grid).toBe("KM72");
  });
});

describe("HealthResponseSchema", () => {
  it("accepts one entry per data source", () => {
    const health = {
      generatedAt: "2026-08-20T12:00:00.000Z",
      sources: [
        { source: "noaa" as const, status: "connected" as const, lastObservationAt: "2026-08-20T11:55:00.000Z", eventsLastFiveMinutes: 1 },
        { source: "rbn" as const, status: "disconnected" as const, lastObservationAt: null, eventsLastFiveMinutes: 0 },
      ],
    };
    expect(HealthResponseSchema.parse(health).sources).toHaveLength(2);
  });

  it("rejects an unknown data source name", () => {
    expect(() =>
      DataSourceHealthSchema.parse({
        source: "unknown",
        status: "connected",
        lastObservationAt: null,
        eventsLastFiveMinutes: 0,
      }),
    ).toThrow();
  });
});
