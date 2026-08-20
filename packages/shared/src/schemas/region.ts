import { z } from "zod";

// SPEC.md §2/§10 "Supported destinations". More regions (Africa, South America,
// Oceania, country, locator, callsign) are added later behind `RegionResolver`
// (packages/core) without changing this scoring-facing enum's consumers.
export const REGION_VALUES = ["EUROPE", "NORTH_AMERICA", "ASIA"] as const;

export const RegionSchema = z.enum(REGION_VALUES);
export type Region = z.infer<typeof RegionSchema>;
