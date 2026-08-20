import { z } from "zod";

// SPEC.md §2 "Operating mode" - V1 only computes/displays General, but the
// property must exist so V2 can score Digital/CW/SSB separately.
export const OPERATING_MODE_VALUES = ["general", "digital", "cw", "ssb"] as const;

export const OperatingModeSchema = z.enum(OPERATING_MODE_VALUES);
export type OperatingMode = z.infer<typeof OperatingModeSchema>;
