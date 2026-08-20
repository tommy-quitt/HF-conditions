import { z } from "zod";

// SPEC.md §3: Maidenhead locators of 4, 6, or 8 characters.
// Field-pair format: [A-R][A-R][0-9][0-9]([A-X][A-X]([0-9][0-9])?)?
// Conversion to/from lat/lon is packages/core's job (SPEC.md §23); this only
// validates shape and normalizes casing so downstream parsing is uniform.
const MAIDENHEAD_GRID_REGEX = /^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/i;

export const MaidenheadGridSchema = z
  .string()
  .regex(MAIDENHEAD_GRID_REGEX, "Invalid Maidenhead locator")
  .transform((value) => value.toUpperCase());

export type MaidenheadGrid = z.infer<typeof MaidenheadGridSchema>;
