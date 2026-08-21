import type { Region } from "@hf-conditions/shared";
import type { LatLon } from "../geo/lat-lon.js";

// SPEC.md §17: a single representative point per destination region, used
// only as the "destination representative point" input to the day/night path
// modifier - a coarse sanity check, not a precise model (spec explicitly
// rules out emulating VOACAP).
export const REGION_REPRESENTATIVE_POINTS: Record<Region, LatLon> = {
  EUROPE: { lat: 50, lon: 10 },
  NORTH_AMERICA: { lat: 40, lon: -95 },
  ASIA: { lat: 35, lon: 105 },
};
