import { describe, expect, it } from "vitest";
import { greatCircleDistanceKm } from "@hf-conditions/core";

describe("greatCircleDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(greatCircleDistanceKm({ lat: 32, lon: 35 }, { lat: 32, lon: 35 })).toBeCloseTo(0, 3);
  });

  it("matches a known distance (London to New York, ~5570km)", () => {
    const london = { lat: 51.5074, lon: -0.1278 };
    const newYork = { lat: 40.7128, lon: -74.006 };
    expect(greatCircleDistanceKm(london, newYork)).toBeCloseTo(5570, -2);
  });
});
