import { describe, expect, it } from "vitest";
import { classifyBand } from "@hf-conditions/core";

describe("classifyBand", () => {
  it("classifies frequencies into their amateur band", () => {
    expect(classifyBand(1900)).toBe("160m");
    expect(classifyBand(3700)).toBe("80m");
    expect(classifyBand(7040)).toBe("40m");
    expect(classifyBand(10106)).toBe("30m");
    expect(classifyBand(14074)).toBe("20m");
    expect(classifyBand(18100)).toBe("17m");
    expect(classifyBand(21200)).toBe("15m");
    expect(classifyBand(24915)).toBe("12m");
    expect(classifyBand(28400)).toBe("10m");
  });

  it("returns null for a frequency outside any supported band", () => {
    expect(classifyBand(50100)).toBeNull();
    expect(classifyBand(100)).toBeNull();
  });
});
