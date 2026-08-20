import { z } from "zod";
import { MaidenheadGridSchema } from "./grid.js";

// SPEC.md §3/§22: QTH may arrive as a grid locator, as lat/lon, or both once
// resolved. `grid` is optional because a request may supply only lat/lon.
export const QthSchema = z.object({
  grid: MaidenheadGridSchema.optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export type Qth = z.infer<typeof QthSchema>;
