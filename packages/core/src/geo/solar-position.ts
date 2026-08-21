import type { LatLon } from "./lat-lon.js";

// SPEC.md §17: solar elevation at a point, used only as a coarse day/night
// path modifier - not a full ephemeris. Standard NOAA solar-position
// approximation (declination + equation of time), deterministic and
// network-free.
export interface SolarElevationInput extends LatLon {
  at: Date;
}

export function solarElevationDeg({ lat, lon, at }: SolarElevationInput): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const dayOfYear = Math.floor(
    (Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()) -
      Date.UTC(at.getUTCFullYear(), 0, 0)) /
      MS_PER_DAY,
  );
  const utcHours = at.getUTCHours() + at.getUTCMinutes() / 60 + at.getUTCSeconds() / 3600;

  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (utcHours - 12) / 24);

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const equationOfTimeMinutes =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const trueSolarTimeMinutes = utcHours * 60 + equationOfTimeMinutes + 4 * lon;
  const hourAngleDeg = trueSolarTimeMinutes / 4 - 180;
  const hourAngleRad = toRadians(hourAngleDeg);
  const latRad = toRadians(lat);

  const sinElevation =
    Math.sin(latRad) * Math.sin(declination) +
    Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngleRad);

  return (Math.asin(clamp(sinElevation, -1, 1)) * 180) / Math.PI;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
