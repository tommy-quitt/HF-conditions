import type { DxccEntity } from "./dxcc-region-resolver.js";
import { createDxccRegionResolver } from "./dxcc-region-resolver.js";
import { createCoordinateRegionResolver } from "./coordinate-region-resolver.js";
import type { RegionResolver } from "./region-resolver.js";

export interface CreateRegionResolverOptions {
  dxccTable?: readonly DxccEntity[];
}

// SPEC.md §10: coordinates are preferred when available; DXCC/callsign
// resolution is the fallback when they aren't (or when coordinates fall
// outside the three destination regions this resolver knows about).
export function createRegionResolver(options: CreateRegionResolverOptions = {}): RegionResolver {
  const coordinateResolver = createCoordinateRegionResolver();
  const dxccResolver = createDxccRegionResolver(options.dxccTable ?? []);

  return {
    resolve(input) {
      if (input.lat !== undefined && input.lon !== undefined) {
        const byCoordinates = coordinateResolver.resolve(input);
        if (byCoordinates) return byCoordinates;
      }
      return dxccResolver.resolve(input);
    },
  };
}
