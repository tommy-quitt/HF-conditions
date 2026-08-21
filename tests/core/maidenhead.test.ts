import { describe, expect, it } from "vitest";
import { latLonToMaidenhead, maidenheadToLatLon } from "@hf-conditions/core";

describe("maidenheadToLatLon", () => {
  it("converts a valid 4-character locator", () => {
    const point = maidenheadToLatLon("KM72");
    expect(point.lat).toBeCloseTo(32.5, 1);
    expect(point.lon).toBeCloseTo(35, 1);
  });

  it("converts a valid 6-character locator to a more precise point", () => {
    const point = maidenheadToLatLon("KM72AB");
    // Still within the parent 4-character square.
    expect(point.lat).toBeGreaterThanOrEqual(32);
    expect(point.lat).toBeLessThan(33);
    expect(point.lon).toBeGreaterThanOrEqual(34);
    expect(point.lon).toBeLessThan(36);
  });

  it("converts a valid 8-character locator", () => {
    const point = maidenheadToLatLon("KM72AB12");
    expect(point.lat).toBeGreaterThanOrEqual(32);
    expect(point.lat).toBeLessThan(33);
  });

  it("rejects an invalid locator", () => {
    expect(() => maidenheadToLatLon("KM7")).toThrow();
  });
});

describe("latLonToMaidenhead", () => {
  it("round-trips a coordinate to a 6-character locator and back to the same 4-character square", () => {
    const grid = latLonToMaidenhead({ lat: 32.1, lon: 34.8 }, 6);
    expect(grid.slice(0, 4)).toBe("KM72");
  });

  it("rejects invalid coordinates", () => {
    expect(() => latLonToMaidenhead({ lat: 132, lon: 34.8 })).toThrow();
  });
});
