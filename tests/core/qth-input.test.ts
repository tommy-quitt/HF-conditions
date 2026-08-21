import { describe, expect, it } from "vitest";
import { resolveQthInput } from "@hf-conditions/core";

describe("resolveQthInput", () => {
  it("resolves a grid parameter into lat/lon", () => {
    const qth = resolveQthInput({ grid: "km72" });
    expect(qth?.grid).toBe("KM72");
    expect(qth?.lat).toBeCloseTo(32.5, 1);
    expect(qth?.lon).toBeCloseTo(35, 1);
  });

  it("resolves lat/lon parameters into a display grid", () => {
    const qth = resolveQthInput({ lat: "32.1", lon: "34.8" });
    expect(qth?.grid).toBe("KM72");
    expect(qth?.lat).toBe(32.1);
    expect(qth?.lon).toBe(34.8);
  });

  it("prefers grid over lat/lon when both are given", () => {
    const qth = resolveQthInput({ grid: "KM72", lat: "0", lon: "0" });
    expect(qth?.grid).toBe("KM72");
  });

  it("returns null for an invalid grid and no coordinates", () => {
    expect(resolveQthInput({ grid: "not-a-grid" })).toBeNull();
  });

  it("returns null for out-of-range coordinates", () => {
    expect(resolveQthInput({ lat: "132", lon: "34.8" })).toBeNull();
  });

  it("returns null when nothing is provided", () => {
    expect(resolveQthInput({})).toBeNull();
  });
});
