import type { PropagationSpot } from "@hf-conditions/shared";
import { PropagationSpotSchema } from "@hf-conditions/shared";
import { classifyBand } from "@hf-conditions/core";

// SPEC.md §7.4, adapted per DEVIATIONS.md: a scheduled HTTPS GET against
// holycluster.iarc.org's `/history` aggregator instead of a persistent
// Telnet connection to a DX Cluster node. Verified live:
// `?start_time=&end_time=` takes UNIX seconds (not ISO timestamps - a plain
// ISO string 422s), and returns `{"spots": [...]}` with per-spot lat/lon
// ([lon, lat] order) and DXCC codes already resolved - no locator parsing
// needed, unlike PSKReporter/RBN. Unlike PSKReporter's query API, this
// endpoint is a genuine global firehose for the requested time window, not
// scoped to a callsign/grid - a future move to per-viewer QTHs would only
// need to re-run the (already QTH-aware) bucketing against this same fetch,
// not a different query per viewer.
//
// The feed blends classic manually-spotted DX-cluster activity with
// activator-program spots (POTA/WWFF/SOTA, seen live via the `type` field).
// All of it is human-initiated, so V1 folds it into one `dxCluster` evidence
// source (SPEC.md §7.4's "human cluster spots" characterization) rather than
// modeling per-activity-type sources.
const HISTORY_URL = "https://holycluster.iarc.org/history";
const DEFAULT_SOURCE_CLUSTER = "holycluster";

interface RawSpot {
  spotter_callsign: string;
  spotter_loc?: [number, number];
  spotter_dxcc_code?: number;
  dx_callsign: string;
  dx_loc?: [number, number];
  dx_dxcc_code?: number;
  freq: number;
  mode?: string;
  time: number;
  comment?: string;
}

interface RawHistoryResponse {
  spots?: RawSpot[];
}

function toLatLon(loc: [number, number] | undefined): { lat: number; lon: number } | undefined {
  if (!loc) return undefined;
  const [lon, lat] = loc;
  return typeof lat === "number" && typeof lon === "number" ? { lat, lon } : undefined;
}

function normalizeSpot(raw: RawSpot, sourceCluster: string): PropagationSpot | null {
  const band = classifyBand(raw.freq);
  if (!band) return null;

  const dxPoint = toLatLon(raw.dx_loc);
  const spotterPoint = toLatLon(raw.spotter_loc);

  const candidate = {
    id: `dxCluster-${raw.dx_callsign}-${raw.spotter_callsign}-${raw.freq}-${raw.time}`,
    timestamp: new Date(raw.time * 1000).toISOString(),
    source: "dxCluster" as const,
    band,
    frequencyKhz: raw.freq,
    mode: raw.mode && raw.mode.length > 0 ? raw.mode : "unknown",
    txCall: raw.dx_callsign,
    rxCall: raw.spotter_callsign,
    txLat: dxPoint?.lat,
    txLon: dxPoint?.lon,
    rxLat: spotterPoint?.lat,
    rxLon: spotterPoint?.lon,
    txDxcc: raw.dx_dxcc_code,
    rxDxcc: raw.spotter_dxcc_code,
    isAutomated: false,
    spotterCall: raw.spotter_callsign,
    comment: raw.comment,
    sourceCluster,
  };

  // HolyCluster is untrusted external input (AGENTS.md) - reject a
  // malformed record rather than letting it through in a guessed shape.
  const parsed = PropagationSpotSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export interface FetchHolyClusterOptions {
  windowMinutes: number;
  sourceCluster?: string;
}

export async function fetchHolyClusterSpots(options: FetchHolyClusterOptions): Promise<PropagationSpot[]> {
  const endSeconds = Math.floor(Date.now() / 1000);
  const startSeconds = endSeconds - Math.round(options.windowMinutes * 60);
  const params = new URLSearchParams({
    start_time: String(startSeconds),
    end_time: String(endSeconds),
  });

  const response = await fetch(`${HISTORY_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HolyCluster request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as RawHistoryResponse;
  const sourceCluster = options.sourceCluster ?? DEFAULT_SOURCE_CLUSTER;

  const spots: PropagationSpot[] = [];
  for (const raw of body.spots ?? []) {
    const spot = normalizeSpot(raw, sourceCluster);
    if (spot) spots.push(spot);
  }
  return spots;
}
