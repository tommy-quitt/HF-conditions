import { z } from "zod";
import { BandSchema } from "./band.js";
import { MaidenheadGridSchema } from "./grid.js";

// SPEC.md §7.2-7.4/§24 propagation_spots, normalized across the three
// reception sources. Adapters validate raw external payloads against this
// shape before anything crosses into packages/core (AGENTS.md).
export const SpotSourceSchema = z.enum(["pskReporter", "rbn", "dxCluster"]);
export type SpotSource = z.infer<typeof SpotSourceSchema>;

export const PropagationSpotSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().datetime(),
  source: SpotSourceSchema,
  band: BandSchema,
  frequencyKhz: z.number().positive(),
  mode: z.string().min(1),
  txCall: z.string().min(1),
  rxCall: z.string().min(1),
  // Locators/coordinates/DXCC are optional: not every source resolves all of
  // them (SPEC.md §7.2 "do not assume every observation contains valid
  // locators"). Reject malformed ones rather than guessing - see
  // MaidenheadGridSchema.
  txGrid: MaidenheadGridSchema.optional(),
  rxGrid: MaidenheadGridSchema.optional(),
  txLat: z.number().min(-90).max(90).optional(),
  txLon: z.number().min(-180).max(180).optional(),
  rxLat: z.number().min(-90).max(90).optional(),
  rxLon: z.number().min(-180).max(180).optional(),
  txDxcc: z.number().int().optional(),
  rxDxcc: z.number().int().optional(),
  // SPEC.md §13: never convert raw cross-source SNR directly - omit rather
  // than invent a normalization when one isn't available.
  snr: z.number().optional(),
  // SPEC.md §7.4: human cluster spots carry lower statistical weight than
  // automated reception reports. PSKReporter/RBN are always automated; DX
  // Cluster spots are always human-sourced.
  isAutomated: z.boolean(),
  // DX Cluster-only fields (SPEC.md §7.4).
  spotterCall: z.string().optional(),
  comment: z.string().optional(),
  sourceCluster: z.string().optional(),
});
export type PropagationSpot = z.infer<typeof PropagationSpotSchema>;
