import type { SolarObservation } from "@hf-conditions/shared";
import { SolarObservationSchema } from "@hf-conditions/shared";

// SPEC.md §7.1: plain HTTP GET against NOAA SWPC's public JSON feeds - no
// deviation from spec here (DEVIATIONS.md), this was always request/
// response. Verified live: both feeds return current, well-formed JSON.
const KP_INDEX_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const F107_FLUX_URL = "https://services.swpc.noaa.gov/json/f107_cm_flux.json";

interface KpIndexEntry {
  time_tag: string;
  Kp: number;
}

interface F107FluxEntry {
  time_tag: string;
  flux: number;
}

// NOAA time_tags are UTC without a zone suffix; SolarObservationSchema
// requires a proper ISO 8601 datetime.
function toIsoTimestamp(noaaTimeTag: string): string {
  return noaaTimeTag.endsWith("Z") ? noaaTimeTag : `${noaaTimeTag}Z`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NOAA request to ${url} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

// The Kp feed is sorted oldest-first (3-hourly readings) - the latest
// reading is the last entry.
async function fetchLatestKp(): Promise<{ kp: number; observedAt: string }> {
  const entries = await fetchJson<KpIndexEntry[]>(KP_INDEX_URL);
  const latest = entries.at(-1);
  if (!latest) {
    throw new Error("NOAA Kp index feed returned no entries");
  }
  return { kp: latest.Kp, observedAt: toIsoTimestamp(latest.time_tag) };
}

// The F10.7 feed is sorted newest-first (a few readings per day) - the
// latest reading is the first entry.
async function fetchLatestF107(): Promise<{ f107: number; observedAt: string }> {
  const entries = await fetchJson<F107FluxEntry[]>(F107_FLUX_URL);
  const latest = entries[0];
  if (!latest) {
    throw new Error("NOAA F10.7 flux feed returned no entries");
  }
  return { f107: latest.flux, observedAt: toIsoTimestamp(latest.time_tag) };
}

export async function fetchNoaaSolarObservation(): Promise<SolarObservation> {
  const [kp, f107] = await Promise.all([fetchLatestKp(), fetchLatestF107()]);
  const observedAt = kp.observedAt > f107.observedAt ? kp.observedAt : f107.observedAt;

  return SolarObservationSchema.parse({
    observedAt,
    f107: f107.f107,
    kp: kp.kp,
    source: "noaa",
  });
}
