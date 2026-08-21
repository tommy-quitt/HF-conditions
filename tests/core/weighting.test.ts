import { describe, expect, it } from "vitest";
import { directionWeight, localityWeight, recencyWeight, spotWeight } from "@hf-conditions/core";

describe("recencyWeight", () => {
  it("follows the 15-minute half-life table from SPEC.md §11", () => {
    expect(recencyWeight(0)).toBeCloseTo(1.0, 4);
    expect(recencyWeight(15)).toBeCloseTo(0.5, 4);
    expect(recencyWeight(30)).toBeCloseTo(0.25, 4);
    expect(recencyWeight(45)).toBeCloseTo(0.125, 4);
    expect(recencyWeight(60)).toBeCloseTo(0.0625, 4);
  });

  it("ignores observations older than 60 minutes", () => {
    expect(recencyWeight(61)).toBe(0);
  });
});

describe("localityWeight", () => {
  it("gives nearly full weight at the QTH itself", () => {
    expect(localityWeight(0)).toBeCloseTo(1.0, 4);
  });

  it("decreases with distance and reaches 0 beyond 4000km", () => {
    const near = localityWeight(300);
    const far = localityWeight(800);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(localityWeight(4000.1)).toBe(0);
  });
});

describe("directionWeight", () => {
  it("weights outbound observations at 1.0 and inbound at 0.90", () => {
    expect(directionWeight("outboundFromQth")).toBe(1.0);
    expect(directionWeight("inboundToQth")).toBe(0.9);
  });
});

describe("spotWeight", () => {
  it("combines locality, direction and recency multiplicatively", () => {
    const weight = spotWeight({ distanceKm: 0, ageMinutes: 0, direction: "outboundFromQth" });
    expect(weight).toBeCloseTo(1.0, 4);
  });

  it("is 0 once distance exceeds the locality cutoff regardless of recency", () => {
    expect(spotWeight({ distanceKm: 4001, ageMinutes: 0, direction: "outboundFromQth" })).toBe(0);
  });
});
