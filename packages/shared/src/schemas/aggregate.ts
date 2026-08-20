import { z } from "zod";
import { BandSchema } from "./band.js";
import { RegionSchema } from "./region.js";
import { SpotSourceSchema } from "./spot.js";

// SPEC.md §7.2/§25: five-minute rollups of raw spots, kept once raw retention
// (60-120 min) expires, so longer-window analysis and future calibration
// (§35) don't depend on data that has already been pruned. One bucket per
// source/band/region combination.
export const SpotAggregateBucketSchema = z.object({
  bucketStart: z.string().datetime(),
  bucketEnd: z.string().datetime(),
  source: SpotSourceSchema,
  band: BandSchema,
  region: RegionSchema,
  weightedSpotCount: z.number().nonnegative(),
  uniqueStationCount: z.number().int().nonnegative(),
  uniquePathCount: z.number().int().nonnegative(),
  averageSnr: z.number().optional(),
});
export type SpotAggregateBucket = z.infer<typeof SpotAggregateBucketSchema>;
