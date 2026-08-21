import type { Region } from "@hf-conditions/shared";
import type { RegionResolver } from "./region-resolver.js";

// SPEC.md §10: "resolve callsign/DXCC using a maintained amateur-radio
// DXCC/CTY dataset ... must be redistributable, have its license documented,
// and be updateable independently of application code." This resolver takes
// that dataset as an injected table rather than hardcoding it, satisfying
// the interface today; sourcing and license-verifying the real dataset (e.g.
// AD1C's cty.dat or an equivalent) is deferred to when the collector
// actually needs it (TASKS.md step 4+), per the project's practice of
// verifying external claims live before locking them in.
export interface DxccEntity {
  entityCode: number;
  continent: Region;
}

export function createDxccRegionResolver(table: readonly DxccEntity[]): RegionResolver {
  const continentByEntityCode = new Map(table.map((entity) => [entity.entityCode, entity.continent]));

  return {
    resolve({ dxccEntityCode }) {
      if (dxccEntityCode === undefined) return null;
      return continentByEntityCode.get(dxccEntityCode) ?? null;
    },
  };
}
