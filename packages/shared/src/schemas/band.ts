import { z } from "zod";

// SPEC.md §2 "Supported bands"
export const BAND_VALUES = [
  "160m",
  "80m",
  "60m",
  "40m",
  "30m",
  "20m",
  "17m",
  "15m",
  "12m",
  "10m",
] as const;

export const BandSchema = z.enum(BAND_VALUES);
export type Band = z.infer<typeof BandSchema>;
