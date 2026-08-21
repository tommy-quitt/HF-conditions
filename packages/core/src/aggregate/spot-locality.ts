import type { PropagationSpot } from "@hf-conditions/shared";
import type { LatLon } from "../geo/lat-lon.js";
import { greatCircleDistanceKm } from "../geo/distance.js";
import { LOCALITY_MAX_KM, type ObservationDirection } from "../weighting.js";
import type { RegionResolverInput } from "../region/region-resolver.js";

// SPEC.md §8/§9: a reception event is relevant when one endpoint is near
// the QTH and the other is the "remote" endpoint to classify into a
// destination region. Neither endpoint has to literally be the user's own
// callsign. Returns null when neither endpoint is within LOCALITY_MAX_KM of
// the QTH - such a spot has zero locality weight regardless of source, so
// it contributes nothing.
export interface SpotLocality {
  localSide: "tx" | "rx";
  distanceKm: number;
  direction: ObservationDirection;
  remote: RegionResolverInput;
}

export function resolveSpotLocality(spot: PropagationSpot, qth: LatLon): SpotLocality | null {
  const txPoint: LatLon | null =
    spot.txLat !== undefined && spot.txLon !== undefined ? { lat: spot.txLat, lon: spot.txLon } : null;
  const rxPoint: LatLon | null =
    spot.rxLat !== undefined && spot.rxLon !== undefined ? { lat: spot.rxLat, lon: spot.rxLon } : null;

  const distanceTx = txPoint ? greatCircleDistanceKm(qth, txPoint) : Infinity;
  const distanceRx = rxPoint ? greatCircleDistanceKm(qth, rxPoint) : Infinity;

  if (distanceTx > LOCALITY_MAX_KM && distanceRx > LOCALITY_MAX_KM) return null;

  const localSide: "tx" | "rx" = distanceTx <= distanceRx ? "tx" : "rx";
  const distanceKm = localSide === "tx" ? distanceTx : distanceRx;
  // Local == tx means the QTH area transmitted (outbound); local == rx means
  // the QTH area received (inbound) - SPEC.md §9.
  const direction: ObservationDirection = localSide === "tx" ? "outboundFromQth" : "inboundToQth";

  const remote: RegionResolverInput =
    localSide === "tx"
      ? { lat: spot.rxLat, lon: spot.rxLon, dxccEntityCode: spot.rxDxcc }
      : { lat: spot.txLat, lon: spot.txLon, dxccEntityCode: spot.txDxcc };

  return { localSide, distanceKm, direction, remote };
}
