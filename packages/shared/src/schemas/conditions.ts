import { z } from "zod";
import { BandSchema } from "./band.js";
import { MaidenheadGridSchema } from "./grid.js";
import { RegionSchema } from "./region.js";
import { SolarSummarySchema } from "./solar.js";
import { QthSchema } from "./qth.js";

// SPEC.md §5
export const ScoreLabelSchema = z.enum(["Very Poor", "Poor", "Fair", "Good", "Excellent"]);
export type ScoreLabel = z.infer<typeof ScoreLabelSchema>;

// SPEC.md §20
export const ConfidenceLabelSchema = z.enum(["Low", "Medium", "High"]);
export type ConfidenceLabel = z.infer<typeof ConfidenceLabelSchema>;

// SPEC.md §21. Null means "not enough history yet" - never fabricated as
// "stable".
export const TrendSchema = z.enum(["improving", "deteriorating", "stable"]);
export type Trend = z.infer<typeof TrendSchema>;

// SPEC.md §34: every score component must be individually reconstructable,
// never collapsed into a single number. A source evidence field is `null`
// when that source was unavailable and its weight was renormalized away
// (SPEC.md §15) - never defaulted to 0 (AGENTS.md).
export const ConditionComponentsSchema = z.object({
  pskReporter: z.number().min(0).max(100).nullable(),
  rbn: z.number().min(0).max(100).nullable(),
  dxCluster: z.number().min(0).max(100).nullable(),
  observed: z.number().min(0).max(100),
  solarModifier: z.number().min(-20).max(10),
  pathModifier: z.number().min(-10).max(10),
});
export type ConditionComponents = z.infer<typeof ConditionComponentsSchema>;

export const ConditionStatsSchema = z.object({
  weightedReports: z.number().nonnegative(),
  uniqueStations: z.number().int().nonnegative(),
});
export type ConditionStats = z.infer<typeof ConditionStatsSchema>;

// One matrix cell (SPEC.md §4/§6/§22).
export const ConditionCellSchema = z.object({
  band: BandSchema,
  region: RegionSchema,
  score: z.number().int().min(0).max(100),
  label: ScoreLabelSchema,
  confidence: z.number().int().min(0).max(100),
  confidenceLabel: ConfidenceLabelSchema,
  trend: TrendSchema.nullable(),
  components: ConditionComponentsSchema,
  stats: ConditionStatsSchema,
});
export type ConditionCell = z.infer<typeof ConditionCellSchema>;

// SPEC.md §22 full API contract (served as static JSON per DEVIATIONS.md,
// same shape).
export const ConditionsResponseSchema = z.object({
  qth: QthSchema,
  generatedAt: z.string().datetime(),
  solar: SolarSummarySchema,
  conditions: z.array(ConditionCellSchema),
});
export type ConditionsResponse = z.infer<typeof ConditionsResponseSchema>;

// SPEC.md §21/§24 condition_snapshots: five-minute score history per
// band/region, kept so trend (score vs. 15 minutes ago) can be computed and
// so future calibration (§35) has a record of what was predicted when.
export const ConditionSnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  qthGrid: MaidenheadGridSchema,
  band: BandSchema,
  region: RegionSchema,
  score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  components: ConditionComponentsSchema,
});
export type ConditionSnapshot = z.infer<typeof ConditionSnapshotSchema>;
