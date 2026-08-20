import { z } from "zod";

// SPEC.md §7.1/§24. `source` is an enum (rather than a bare literal) so a
// future secondary solar feed doesn't require a breaking schema change.
export const SolarSourceSchema = z.enum(["noaa"]);
export type SolarSource = z.infer<typeof SolarSourceSchema>;

// Full observation as retained by the collector (SPEC.md §24 solar_observations,
// plus the optional §7.1 fields when easily available). Optional fields are
// omitted rather than null/0 when NOAA doesn't report them for a given tick.
export const SolarObservationSchema = z.object({
  observedAt: z.string().datetime(),
  f107: z.number().nonnegative(),
  kp: z.number().min(0).max(9),
  source: SolarSourceSchema,
  solarWindSpeedKmS: z.number().nonnegative().optional(),
  bzNt: z.number().optional(),
  xrayFlareClass: z.string().optional(),
  dRegionAbsorption: z.number().optional(),
  alerts: z.array(z.string()).optional(),
});
export type SolarObservation = z.infer<typeof SolarObservationSchema>;

// Minimal snapshot embedded in the conditions API response (SPEC.md §22).
export const SolarSummarySchema = z.object({
  f107: z.number().nonnegative(),
  kp: z.number().min(0).max(9),
  observedAt: z.string().datetime(),
});
export type SolarSummary = z.infer<typeof SolarSummarySchema>;
