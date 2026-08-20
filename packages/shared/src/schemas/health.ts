import { z } from "zod";

// SPEC.md §31: status of every external data source plus the persistence
// layer. Written to a static health.json per collection run (DEVIATIONS.md) -
// same shape as a live health endpoint would return.
export const DataSourceNameSchema = z.enum(["noaa", "pskReporter", "rbn", "dxCluster", "database"]);
export type DataSourceName = z.infer<typeof DataSourceNameSchema>;

// "degraded" is a practical third state beyond the spec's binary
// connected/disconnected (SPEC.md §26 "Data source degraded" UI state) - e.g.
// a scheduled adapter ran but returned stale or partial data.
export const DataSourceStatusSchema = z.enum(["connected", "disconnected", "degraded"]);
export type DataSourceStatus = z.infer<typeof DataSourceStatusSchema>;

export const DataSourceHealthSchema = z.object({
  source: DataSourceNameSchema,
  status: DataSourceStatusSchema,
  lastObservationAt: z.string().datetime().nullable(),
  eventsLastFiveMinutes: z.number().int().nonnegative(),
});
export type DataSourceHealth = z.infer<typeof DataSourceHealthSchema>;

export const HealthResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  sources: z.array(DataSourceHealthSchema),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
