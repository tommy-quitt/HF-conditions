import { describe, expect, it } from "vitest";
import { createCoordinateRegionResolver, createDxccRegionResolver, createRegionResolver } from "@hf-conditions/core";

describe("createCoordinateRegionResolver", () => {
  const resolver = createCoordinateRegionResolver();

  it("classifies a representative Europe point (Berlin)", () => {
    expect(resolver.resolve({ lat: 52.5, lon: 13.4 })).toBe("EUROPE");
  });

  it("classifies a representative North America point (New York)", () => {
    expect(resolver.resolve({ lat: 40.7, lon: -74.0 })).toBe("NORTH_AMERICA");
  });

  it("classifies a representative Asia point (Tokyo)", () => {
    expect(resolver.resolve({ lat: 35.7, lon: 139.7 })).toBe("ASIA");
  });

  it("returns null when coordinates are missing", () => {
    expect(resolver.resolve({})).toBeNull();
  });

  it("returns null for a point outside the three V1 regions", () => {
    // Central Africa.
    expect(resolver.resolve({ lat: 0, lon: 20 })).toBeNull();
  });
});

describe("createDxccRegionResolver", () => {
  const resolver = createDxccRegionResolver([
    { entityCode: 291, continent: "NORTH_AMERICA" }, // USA
    { entityCode: 230, continent: "EUROPE" }, // Germany
  ]);

  it("resolves a known DXCC entity code", () => {
    expect(resolver.resolve({ dxccEntityCode: 291 })).toBe("NORTH_AMERICA");
  });

  it("returns null for an unknown entity code", () => {
    expect(resolver.resolve({ dxccEntityCode: 9999 })).toBeNull();
  });

  it("returns null when no entity code is provided", () => {
    expect(resolver.resolve({})).toBeNull();
  });
});

describe("createRegionResolver", () => {
  it("prefers coordinates over the DXCC table when both are available", () => {
    const resolver = createRegionResolver({ dxccTable: [{ entityCode: 1, continent: "ASIA" }] });
    expect(resolver.resolve({ lat: 52.5, lon: 13.4, dxccEntityCode: 1 })).toBe("EUROPE");
  });

  it("falls back to the DXCC table when coordinates are unavailable", () => {
    const resolver = createRegionResolver({ dxccTable: [{ entityCode: 1, continent: "ASIA" }] });
    expect(resolver.resolve({ dxccEntityCode: 1 })).toBe("ASIA");
  });

  it("falls back to the DXCC table when coordinates resolve to no known region", () => {
    const resolver = createRegionResolver({ dxccTable: [{ entityCode: 1, continent: "ASIA" }] });
    expect(resolver.resolve({ lat: 0, lon: 20, dxccEntityCode: 1 })).toBe("ASIA");
  });
});
