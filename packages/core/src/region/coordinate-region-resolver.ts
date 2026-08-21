import type { Region } from "@hf-conditions/shared";
import type { RegionResolver } from "./region-resolver.js";

// SPEC.md §10: "Prefer coordinates when a valid locator exists." This is a
// best-effort geographic approximation, not an authoritative continent
// dataset - the Europe/Asia boundary in particular is a coarse diagonal
// (Bosphorus/Caucasus in the south drifting to the Urals in the north) and
// known to misclassify some border cases (e.g. Turkey/Caucasus resolve to
// ASIA here). createDxccRegionResolver is the authoritative path when a
// callsign/DXCC entity is resolvable; this exists for cases where only
// coordinates are available.
function isNorthAmerica(lat: number, lon: number): boolean {
  return lat >= 5 && lat <= 85 && lon >= -170 && lon <= -50;
}

function europeAsiaBoundaryLon(lat: number): number {
  // 35E at lat 34 (Bosphorus/Caucasus latitude) drifting to 60E at lat 72
  // (the Urals).
  const clampedLat = Math.min(Math.max(lat, 34), 72);
  return 35 + ((clampedLat - 34) / (72 - 34)) * 25;
}

function isEurope(lat: number, lon: number): boolean {
  if (lat < 34 || lat > 72) return false;
  if (lon < -25 || lon >= 60) return false;
  return lon < europeAsiaBoundaryLon(lat);
}

function isAsia(lat: number, lon: number): boolean {
  if (lat < -10 || lat > 78) return false;
  if (lon >= -180 && lon <= -170) return true; // Russian Far East, across the dateline
  if (lon < 26) return false;
  if (lon < 60 && lat >= 42) return false; // that band is European Russia
  return lon <= 180;
}

export function classifyByCoordinates(lat: number, lon: number): Region | null {
  if (isNorthAmerica(lat, lon)) return "NORTH_AMERICA";
  if (isEurope(lat, lon)) return "EUROPE";
  if (isAsia(lat, lon)) return "ASIA";
  return null;
}

export function createCoordinateRegionResolver(): RegionResolver {
  return {
    resolve({ lat, lon }) {
      if (lat === undefined || lon === undefined) return null;
      return classifyByCoordinates(lat, lon);
    },
  };
}
