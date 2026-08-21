// Plain lat/lon pair used throughout packages/core. Kept separate from the
// shared QthSchema so this package never needs a Zod dependency at runtime.
export interface LatLon {
  lat: number;
  lon: number;
}
