// SPEC.md §11/§8/§9: recency, locality and direction weighting, combined per
// spot into a single spotWeight.
export const RECENCY_HALF_LIFE_MINUTES = 15;
export const RECENCY_MAX_AGE_MINUTES = 60;

export function recencyWeight(ageMinutes: number): number {
  if (ageMinutes < 0 || ageMinutes > RECENCY_MAX_AGE_MINUTES) return 0;
  return Math.pow(0.5, ageMinutes / RECENCY_HALF_LIFE_MINUTES);
}

// SPEC.md §8: "Make both 600 and 1200 configuration constants."
export const LOCALITY_SIGMA_KM = 600;
export const LOCALITY_MAX_KM = 1200;

export function localityWeight(distanceKm: number): number {
  if (distanceKm < 0 || distanceKm > LOCALITY_MAX_KM) return 0;
  return Math.exp(-Math.pow(distanceKm / LOCALITY_SIGMA_KM, 2));
}

// SPEC.md §9: outbound (QTH area -> destination) is full weight; inbound
// (destination -> QTH area) is discounted slightly for asymmetric antennas/
// receiver noise/station capability.
export type ObservationDirection = "outboundFromQth" | "inboundToQth";

export const DIRECTION_WEIGHTS: Readonly<Record<ObservationDirection, number>> = {
  outboundFromQth: 1.0,
  inboundToQth: 0.9,
};

export function directionWeight(direction: ObservationDirection): number {
  return DIRECTION_WEIGHTS[direction];
}

export interface SpotWeightInput {
  distanceKm: number;
  ageMinutes: number;
  direction: ObservationDirection;
}

// SPEC.md §12
export function spotWeight(input: SpotWeightInput): number {
  return (
    localityWeight(input.distanceKm) * directionWeight(input.direction) * recencyWeight(input.ageMinutes)
  );
}
