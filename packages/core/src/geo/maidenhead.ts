import type { MaidenheadGrid } from "@hf-conditions/shared";
import type { LatLon } from "./lat-lon.js";

// SPEC.md §3: "The application must convert Maidenhead locator to latitude/
// longitude internally" and back, for 4/6/8-character locators. Callers are
// expected to have already validated shape/case with
// @hf-conditions/shared's MaidenheadGridSchema (AGENTS.md) - this still
// guards length defensively since the exported type is a plain string.
const FIELD_CHARS = "ABCDEFGHIJKLMNOPQR";
const SUBSQUARE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWX";
const FIELD_LON_DEG = 20;
const FIELD_LAT_DEG = 10;

export function maidenheadToLatLon(grid: MaidenheadGrid): LatLon {
  const upper = grid.toUpperCase();
  if (![4, 6, 8].includes(upper.length)) {
    throw new Error(`Invalid Maidenhead locator: ${grid}`);
  }

  const lonField = FIELD_CHARS.indexOf(upper[0] ?? "");
  const latField = FIELD_CHARS.indexOf(upper[1] ?? "");
  if (lonField === -1 || latField === -1) {
    throw new Error(`Invalid Maidenhead locator: ${grid}`);
  }

  let lonDeg = lonField * FIELD_LON_DEG - 180;
  let latDeg = latField * FIELD_LAT_DEG - 90;
  let lonSize = FIELD_LON_DEG;
  let latSize = FIELD_LAT_DEG;

  if (upper.length >= 4) {
    const lonSquare = Number(upper[2]);
    const latSquare = Number(upper[3]);
    lonSize /= 10;
    latSize /= 10;
    lonDeg += lonSquare * lonSize;
    latDeg += latSquare * latSize;
  }

  if (upper.length >= 6) {
    const lonSub = SUBSQUARE_CHARS.indexOf(upper[4] ?? "");
    const latSub = SUBSQUARE_CHARS.indexOf(upper[5] ?? "");
    lonSize /= 24;
    latSize /= 24;
    lonDeg += lonSub * lonSize;
    latDeg += latSub * latSize;
  }

  if (upper.length >= 8) {
    const lonExt = Number(upper[6]);
    const latExt = Number(upper[7]);
    lonSize /= 10;
    latSize /= 10;
    lonDeg += lonExt * lonSize;
    latDeg += latExt * latSize;
  }

  // Return the center of the smallest resolved cell rather than its corner.
  return { lat: latDeg + latSize / 2, lon: lonDeg + lonSize / 2 };
}

export function latLonToMaidenhead(point: LatLon, precision: 4 | 6 | 8 = 6): string {
  if (point.lat < -90 || point.lat > 90 || point.lon < -180 || point.lon > 180) {
    throw new Error(`Invalid coordinates: ${point.lat}, ${point.lon}`);
  }

  let lon = Math.min(point.lon + 180, 359.999999);
  let lat = Math.min(point.lat + 90, 179.999999);

  const fieldLon = Math.floor(lon / FIELD_LON_DEG);
  const fieldLat = Math.floor(lat / FIELD_LAT_DEG);
  lon -= fieldLon * FIELD_LON_DEG;
  lat -= fieldLat * FIELD_LAT_DEG;
  let result = FIELD_CHARS.charAt(fieldLon) + FIELD_CHARS.charAt(fieldLat);

  const squareLon = Math.floor(lon / 2);
  const squareLat = Math.floor(lat / 1);
  lon -= squareLon * 2;
  lat -= squareLat * 1;
  result += String(squareLon) + String(squareLat);
  if (precision === 4) return result;

  const subLonSize = 2 / 24;
  const subLatSize = 1 / 24;
  const subLon = Math.floor(lon / subLonSize);
  const subLat = Math.floor(lat / subLatSize);
  lon -= subLon * subLonSize;
  lat -= subLat * subLatSize;
  result += SUBSQUARE_CHARS.charAt(subLon) + SUBSQUARE_CHARS.charAt(subLat);
  if (precision === 6) return result;

  const extLon = Math.floor(lon / (subLonSize / 10));
  const extLat = Math.floor(lat / (subLatSize / 10));
  result += String(extLon) + String(extLat);
  return result;
}
