import { describe, expect, it } from "vitest";
import { greatCircleMidpoint } from "@hf-conditions/core";

describe("greatCircleMidpoint", () => {
  it("returns the same point when both endpoints are equal", () => {
    const point = greatCircleMidpoint({ lat: 32, lon: 35 }, { lat: 32, lon: 35 });
    expect(point.lat).toBeCloseTo(32, 4);
    expect(point.lon).toBeCloseTo(35, 4);
  });

  it("returns the equator midpoint for two equatorial points", () => {
    const point = greatCircleMidpoint({ lat: 0, lon: 0 }, { lat: 0, lon: 20 });
    expect(point.lat).toBeCloseTo(0, 3);
    expect(point.lon).toBeCloseTo(10, 3);
  });
});
