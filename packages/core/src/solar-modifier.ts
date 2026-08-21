import type { Band } from "@hf-conditions/shared";

// SPEC.md §16: Kp penalty table.
export function kpModifier(kp: number): number {
  if (kp < 3) return 0;
  if (kp < 4) return -3;
  if (kp < 5) return -8;
  if (kp < 6) return -15;
  return -20;
}

// SPEC.md §16: F10.7 contribution is strongest on the upper HF bands and
// much smaller on the lower ones; 30m/60m sit between the spec's two named
// groups and are treated as "much smaller" like their lower-band neighbors.
const F107_BAND_SENSITIVITY: Readonly<Record<Band, number>> = {
  "160m": 0.05,
  "80m": 0.05,
  "60m": 0.1,
  "40m": 0.1,
  "30m": 0.15,
  "20m": 1.0,
  "17m": 1.0,
  "15m": 1.0,
  "12m": 1.0,
  "10m": 1.0,
};

const SOLAR_FLUX_MODIFIER_MAX = 10;
const SOLAR_FLUX_BASELINE_F107 = 100;
const SOLAR_FLUX_SATURATION_F107 = 200;

export function solarFluxModifier(band: Band, f107: number): number {
  const fraction = Math.min(
    Math.max((f107 - SOLAR_FLUX_BASELINE_F107) / (SOLAR_FLUX_SATURATION_F107 - SOLAR_FLUX_BASELINE_F107), 0),
    1,
  );
  return fraction * SOLAR_FLUX_MODIFIER_MAX * F107_BAND_SENSITIVITY[band];
}

// SPEC.md §16: overall SolarModifier range.
export const SOLAR_MODIFIER_MIN = -20;
export const SOLAR_MODIFIER_MAX = 10;

export function solarModifier(band: Band, kp: number, f107: number): number {
  const combined = kpModifier(kp) + solarFluxModifier(band, f107);
  return Math.min(Math.max(combined, SOLAR_MODIFIER_MIN), SOLAR_MODIFIER_MAX);
}
