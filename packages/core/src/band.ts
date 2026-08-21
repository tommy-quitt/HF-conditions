import type { Band } from "@hf-conditions/shared";

// SPEC.md §2/§30: classify an observed frequency into one of the supported
// amateur bands. Ranges are a broad, international superset of national band
// plans (e.g. 60m spans multiple countries' distinct channel allocations)
// intended for bucketing observed spots, not for regulatory purposes.
interface BandRange {
  band: Band;
  minKhz: number;
  maxKhz: number;
}

export const BAND_RANGES: readonly BandRange[] = [
  { band: "160m", minKhz: 1800, maxKhz: 2000 },
  { band: "80m", minKhz: 3500, maxKhz: 4000 },
  { band: "60m", minKhz: 5250, maxKhz: 5450 },
  { band: "40m", minKhz: 7000, maxKhz: 7300 },
  { band: "30m", minKhz: 10100, maxKhz: 10150 },
  { band: "20m", minKhz: 14000, maxKhz: 14350 },
  { band: "17m", minKhz: 18068, maxKhz: 18168 },
  { band: "15m", minKhz: 21000, maxKhz: 21450 },
  { band: "12m", minKhz: 24890, maxKhz: 24990 },
  { band: "10m", minKhz: 28000, maxKhz: 29700 },
];

export function classifyBand(frequencyKhz: number): Band | null {
  for (const range of BAND_RANGES) {
    if (frequencyKhz >= range.minKhz && frequencyKhz <= range.maxKhz) {
      return range.band;
    }
  }
  return null;
}
