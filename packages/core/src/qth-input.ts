import type { Qth } from "@hf-conditions/shared";
import { MaidenheadGridSchema, QthSchema } from "@hf-conditions/shared";
import { latLonToMaidenhead, maidenheadToLatLon } from "./geo/maidenhead.js";

// SPEC.md §3: QTH input arrives as either a Maidenhead grid (`?grid=KM72`,
// or the raw text field) or explicit coordinates (`?lat=&lon=`). Pure and
// framework-agnostic so both the URL-param path and the plain text-input
// path in apps/web share one resolver, tested independently of the DOM.
export interface QthInputParams {
  grid?: string | null;
  lat?: string | null;
  lon?: string | null;
}

export function resolveQthInput(params: QthInputParams): Qth | null {
  if (params.grid) {
    const parsedGrid = MaidenheadGridSchema.safeParse(params.grid);
    if (parsedGrid.success) {
      const { lat, lon } = maidenheadToLatLon(parsedGrid.data);
      return { grid: parsedGrid.data, lat, lon };
    }
  }

  if (params.lat != null && params.lon != null) {
    const parsedQth = QthSchema.safeParse({ lat: Number(params.lat), lon: Number(params.lon) });
    if (parsedQth.success) {
      return { ...parsedQth.data, grid: latLonToMaidenhead(parsedQth.data, 4) };
    }
  }

  return null;
}
