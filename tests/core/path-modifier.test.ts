import { describe, expect, it } from "vitest";
import { pathModifier } from "@hf-conditions/core";

describe("pathModifier", () => {
  const noonUtc = new Date("2026-08-20T12:00:00.000Z");
  const midnightUtc = new Date("2026-08-20T00:00:00.000Z");

  it("stays within the -10 to +10 range", () => {
    const points = {
      qth: { lat: 32, lon: 35 },
      midpoint: { lat: 41, lon: 22 },
      destination: { lat: 50, lon: 10 },
    };
    const modifier = pathModifier("20m", points, noonUtc);
    expect(modifier).toBeGreaterThanOrEqual(-10);
    expect(modifier).toBeLessThanOrEqual(10);
  });

  it("favors upper bands when the whole path is in daylight", () => {
    const dayPoints = {
      qth: { lat: 0, lon: 0 },
      midpoint: { lat: 0, lon: 10 },
      destination: { lat: 0, lon: 20 },
    };
    expect(pathModifier("20m", dayPoints, noonUtc)).toBeGreaterThan(0);
  });

  it("favors lower bands when the whole path is in darkness", () => {
    const nightPoints = {
      qth: { lat: 0, lon: 0 },
      midpoint: { lat: 0, lon: 10 },
      destination: { lat: 0, lon: 20 },
    };
    expect(pathModifier("80m", nightPoints, midnightUtc)).toBeGreaterThan(0);
  });
});
