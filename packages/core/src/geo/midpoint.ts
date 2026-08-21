import type { LatLon } from "./lat-lon.js";

// SPEC.md §17: "representative midpoint of the path" input to the day/night
// path modifier - a standard great-circle midpoint, not a full path model.
export function greatCircleMidpoint(a: LatLon, b: LatLon): LatLon {
  const lat1 = toRadians(a.lat);
  const lon1 = toRadians(a.lon);
  const lat2 = toRadians(b.lat);
  const lon2 = toRadians(b.lon);

  const bx = Math.cos(lat2) * Math.cos(lon2 - lon1);
  const by = Math.cos(lat2) * Math.sin(lon2 - lon1);

  const lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2));
  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);

  return { lat: (lat3 * 180) / Math.PI, lon: (((lon3 * 180) / Math.PI + 540) % 360) - 180 };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
