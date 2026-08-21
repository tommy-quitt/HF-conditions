import type { Region } from "@hf-conditions/shared";

// SPEC.md §10: keeps geographic classification behind an interface so future
// region definitions (Africa, South America, Oceania, country, locator,
// callsign) don't require scoring-engine changes.
export interface RegionResolverInput {
  lat?: number;
  lon?: number;
  dxccEntityCode?: number;
}

export interface RegionResolver {
  resolve(input: RegionResolverInput): Region | null;
}
