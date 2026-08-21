import type { Band } from "@hf-conditions/shared";
import type { LatLon } from "./geo/lat-lon.js";
import { solarElevationDeg } from "./geo/solar-position.js";

// SPEC.md §17: day/night path modifier - "a modest modifier", "a physical
// sanity check", not a VOACAP-style model.
const LOWER_BANDS: ReadonlySet<Band> = new Set(["160m", "80m", "60m", "40m", "30m"]);

export const PATH_MODIFIER_MIN = -10;
export const PATH_MODIFIER_MAX = 10;

export interface PathPoints {
  qth: LatLon;
  midpoint: LatLon;
  destination: LatLon;
}

export function pathModifier(band: Band, points: PathPoints, at: Date): number {
  const elevations = [points.qth, points.midpoint, points.destination].map((point) =>
    solarElevationDeg({ lat: point.lat, lon: point.lon, at }),
  );
  const daylightFraction = elevations.filter((elevation) => elevation > 0).length / elevations.length;

  // Lower bands benefit from darkness; upper bands benefit from daylight.
  const swing = LOWER_BANDS.has(band) ? 0.5 - daylightFraction : daylightFraction - 0.5;
  const modifier = swing * (2 * PATH_MODIFIER_MAX);

  return Math.min(Math.max(modifier, PATH_MODIFIER_MIN), PATH_MODIFIER_MAX);
}
