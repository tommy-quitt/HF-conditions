import { BAND_VALUES, REGION_VALUES } from "@hf-conditions/shared";
import type {
  Band,
  ConditionCell,
  ConditionComponents,
  ConditionsResponse,
  Qth,
  Region,
  SolarSummary,
  SpotAggregateBucket,
  SpotSource,
} from "@hf-conditions/shared";
import { summarizeRecentAggregates } from "./aggregate/summarize-aggregate-evidence.js";
import { confidenceLabel, confidenceScore } from "./confidence.js";
import { clusterEvidence, sourceEvidence } from "./evidence.js";
import { NO_DATA_BASELINE_SCORE, finalScore } from "./final-score.js";
import { greatCircleMidpoint } from "./geo/midpoint.js";
import { observedScore, type SourceEvidence } from "./observed-score.js";
import { pathModifier } from "./path-modifier.js";
import { REGION_REPRESENTATIVE_POINTS } from "./region/representative-points.js";
import { scoreLabel } from "./score-label.js";
import { solarModifier } from "./solar-modifier.js";

// The orchestrator that ties every other packages/core module together into
// one ConditionCell per band/region - the client-side replacement for
// SPEC.md §22's `GET /api/conditions` (DEVIATIONS.md). Pure and
// deterministic: no network/db access, so it runs unchanged in the
// collector and in the browser (AGENTS.md).
export interface ComputeConditionsInput {
  qth: Qth;
  solar: SolarSummary;
  buckets: readonly SpotAggregateBucket[];
  now: Date;
}

interface SourceContribution {
  evidence: number;
  weightedSpotCount: number;
  uniqueStationCount: number;
  freshnessMinutes: number;
}

function evidenceForSource(
  buckets: readonly SpotAggregateBucket[],
  source: SpotSource,
  band: Band,
  region: Region,
  now: Date,
): SourceContribution | null {
  const summary = summarizeRecentAggregates(buckets, { source, band, region }, now);
  if (!summary) return null;

  const evidence =
    source === "dxCluster"
      ? clusterEvidence(summary.weightedSpotCount, summary.uniqueStationCount)
      : sourceEvidence(summary.weightedSpotCount, summary.uniquePathCount);

  return {
    evidence,
    weightedSpotCount: summary.weightedSpotCount,
    uniqueStationCount: summary.uniqueStationCount,
    freshnessMinutes: summary.freshnessMinutes,
  };
}

// SPEC.md §21: trend needs a score from 15 minutes ago, which requires
// retained history this project doesn't build yet (TASKS.md step 9) - so
// this always returns null (never a fabricated "stable") until that lands.
export function computeConditionCell(band: Band, region: Region, input: ComputeConditionsInput): ConditionCell {
  const psk = evidenceForSource(input.buckets, "pskReporter", band, region, input.now);
  const rbn = evidenceForSource(input.buckets, "rbn", band, region, input.now);
  const dxCluster = evidenceForSource(input.buckets, "dxCluster", band, region, input.now);

  const sourceEvidenceInput: SourceEvidence = {
    pskReporter: psk?.evidence ?? null,
    rbn: rbn?.evidence ?? null,
    dxCluster: dxCluster?.evidence ?? null,
  };
  const observed = observedScore(sourceEvidenceInput);

  const solarMod = solarModifier(band, input.solar.kp, input.solar.f107);
  const destination = REGION_REPRESENTATIVE_POINTS[region];
  const midpoint = greatCircleMidpoint(input.qth, destination);
  const pathMod = pathModifier(band, { qth: input.qth, midpoint, destination }, input.now);

  const score = finalScore({ observedScore: observed, solarModifier: solarMod, pathModifier: pathMod });

  const contributions = [psk, rbn, dxCluster];
  const availableSourceCount = contributions.filter((entry): entry is SourceContribution => entry !== null).length;
  const weightedReports = contributions.reduce((sum, entry) => sum + (entry?.weightedSpotCount ?? 0), 0);
  const uniqueStations = contributions.reduce((sum, entry) => sum + (entry?.uniqueStationCount ?? 0), 0);
  const freshnessMinutes = contributions.reduce<number | null>((freshest, entry) => {
    if (!entry) return freshest;
    return freshest === null ? entry.freshnessMinutes : Math.min(freshest, entry.freshnessMinutes);
  }, null);

  const confidence = confidenceScore({
    availableSourceCount,
    weightedReports,
    uniqueStations,
    freshnessMinutes,
    hasValidLocations: availableSourceCount > 0,
  });

  // SPEC.md §34: when there's no observed evidence at all, `components.observed`
  // records the no-data baseline that finalScore actually used, so the stored
  // components always reconstruct how the final score was derived.
  const components: ConditionComponents = {
    pskReporter: psk?.evidence ?? null,
    rbn: rbn?.evidence ?? null,
    dxCluster: dxCluster?.evidence ?? null,
    observed: observed ?? NO_DATA_BASELINE_SCORE,
    solarModifier: solarMod,
    pathModifier: pathMod,
  };

  return {
    band,
    region,
    score,
    label: scoreLabel(score),
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    trend: null,
    components,
    stats: { weightedReports, uniqueStations },
  };
}

export function computeConditions(input: ComputeConditionsInput): ConditionsResponse {
  const conditions: ConditionCell[] = [];
  for (const band of BAND_VALUES) {
    for (const region of REGION_VALUES) {
      conditions.push(computeConditionCell(band, region, input));
    }
  }

  return {
    qth: input.qth,
    generatedAt: input.now.toISOString(),
    solar: input.solar,
    conditions,
  };
}
