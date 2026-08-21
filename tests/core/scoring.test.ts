import { describe, expect, it } from "vitest";
import {
  clusterEvidence,
  confidenceLabel,
  confidenceScore,
  finalScore,
  observedScore,
  scoreLabel,
  solarModifier,
  sourceEvidence,
  trend,
} from "@hf-conditions/core";

describe("sourceEvidence / clusterEvidence", () => {
  it("returns near 0 with no reports and approaches 100 with heavy activity", () => {
    expect(sourceEvidence(0, 0)).toBe(0);
    expect(sourceEvidence(200, 200)).toBeGreaterThan(95);
  });

  it("clusterEvidence uses its own saturation constants", () => {
    expect(clusterEvidence(0, 0)).toBe(0);
    expect(clusterEvidence(100, 100)).toBeGreaterThan(95);
  });
});

describe("observedScore", () => {
  it("renormalizes weights when a source is missing rather than treating it as 0", () => {
    const full = observedScore({ pskReporter: 80, rbn: 80, dxCluster: 80 });
    const missingRbn = observedScore({ pskReporter: 80, rbn: null, dxCluster: 80 });
    expect(full).toBeCloseTo(80, 4);
    expect(missingRbn).toBeCloseTo(80, 4);
  });

  it("returns null when every source is unavailable", () => {
    expect(observedScore({ pskReporter: null, rbn: null, dxCluster: null })).toBeNull();
  });
});

describe("solarModifier", () => {
  it("applies a heavy penalty during a high-Kp event", () => {
    expect(solarModifier("20m", 7, 100)).toBe(-20);
  });

  it("gives upper bands more benefit from high solar flux than lower bands", () => {
    const upper = solarModifier("10m", 0, 200);
    const lower = solarModifier("80m", 0, 200);
    expect(upper).toBeGreaterThan(lower);
  });
});

describe("finalScore", () => {
  it("combines observed score with solar/path modifiers per the SPEC.md §18 example", () => {
    expect(finalScore({ observedScore: 82, solarModifier: 4, pathModifier: 3 })).toBe(89);
  });

  it("represents excellent live evidence", () => {
    const observed = observedScore({ pskReporter: 95, rbn: 92, dxCluster: 88 });
    expect(finalScore({ observedScore: observed, solarModifier: 5, pathModifier: 5 })).toBeGreaterThan(85);
  });

  it("represents weak evidence as a low-but-nonzero score", () => {
    const observed = observedScore({ pskReporter: 8, rbn: 5, dxCluster: 0 });
    const score = finalScore({ observedScore: observed, solarModifier: 0, pathModifier: 0 });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(30);
  });

  it("represents no evidence with a conservative score capped at 60", () => {
    const score = finalScore({ observedScore: null, solarModifier: 10, pathModifier: 10 });
    expect(score).toBeLessThanOrEqual(60);
  });

  it("clamps at 0 for a severe negative combination", () => {
    expect(finalScore({ observedScore: 5, solarModifier: -20, pathModifier: -10 })).toBe(0);
  });

  it("clamps at 100 for a maximal positive combination", () => {
    expect(finalScore({ observedScore: 100, solarModifier: 10, pathModifier: 10 })).toBe(100);
  });
});

describe("scoreLabel", () => {
  it("maps scores to the SPEC.md §5 labels", () => {
    expect(scoreLabel(0)).toBe("Very Poor");
    expect(scoreLabel(19)).toBe("Very Poor");
    expect(scoreLabel(20)).toBe("Poor");
    expect(scoreLabel(59)).toBe("Fair");
    expect(scoreLabel(60)).toBe("Good");
    expect(scoreLabel(100)).toBe("Excellent");
  });
});

describe("confidenceScore / confidenceLabel", () => {
  it("is low confidence for stale data with a missing source", () => {
    const score = confidenceScore({
      availableSourceCount: 1,
      weightedReports: 1,
      uniqueStations: 1,
      freshnessMinutes: 55,
      hasValidLocations: false,
    });
    expect(confidenceLabel(score)).toBe("Low");
  });

  it("is high confidence for fresh, abundant, diverse, well-located evidence", () => {
    const score = confidenceScore({
      availableSourceCount: 3,
      weightedReports: 50,
      uniqueStations: 30,
      freshnessMinutes: 1,
      hasValidLocations: true,
    });
    expect(confidenceLabel(score)).toBe("High");
  });
});

describe("trend", () => {
  it("does not calculate a trend until enough history exists", () => {
    expect(trend(80, null)).toBeNull();
  });

  it("reports improving/deteriorating/stable per the +-7 thresholds", () => {
    expect(trend(87, 80)).toBe("improving");
    expect(trend(73, 80)).toBe("deteriorating");
    expect(trend(83, 80)).toBe("stable");
  });
});
