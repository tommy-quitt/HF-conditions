import type { PropagationSpot } from "@hf-conditions/shared";
import { PropagationSpotSchema } from "@hf-conditions/shared";
import { classifyBand, maidenheadToLatLon } from "@hf-conditions/core";

// SPEC.md §7.2, adapted per DEVIATIONS.md's V1 fixed-QTH simplification:
// PSKReporter's HTTP query API is grid/callsign-scoped, not a global
// firehose, so this collector queries reception reports for one fixed home
// grid rather than an arbitrary per-viewer QTH. Verified live against
// retrieve.pskreporter.info: `callsign=<grid>&modify=grid` returns
// reception reports where either side is in that grid, with
// isSender/isReceiver, locators, DXCC names, frequency, mode and SNR. The
// documented `callback=` (JSONP) parameter conveniently also returns clean
// JSON instead of the default XML - Node isn't subject to browser CORS, so
// this isn't a CORS workaround, just the easiest content-type to parse
// without adding an XML dependency.
const QUERY_URL = "https://retrieve.pskreporter.info/query";
const JSONP_CALLBACK_NAME = "hfConditionsCollector";
const MAX_WINDOW_MINUTES = 24 * 60;
const MAIDENHEAD_REGEX = /^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/;

interface RawReceptionReport {
  receiverCallsign: string;
  receiverLocator?: string;
  senderCallsign: string;
  senderLocator?: string;
  frequency: number;
  flowStartSeconds: number;
  mode: string;
  sNR?: number;
}

interface RawQueryResponse {
  receptionReport?: RawReceptionReport[];
}

function unwrapJsonp(body: string): RawQueryResponse {
  const start = body.indexOf("(");
  const end = body.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected PSKReporter response shape: JSONP wrapper not found");
  }
  return JSON.parse(body.slice(start + 1, end)) as RawQueryResponse;
}

// PSKReporter locators are sometimes reported at sub-square precision (more
// than 8 characters). Truncate to the nearest 8-character cell rather than
// dropping a perfectly real, just-too-precise locator.
function normalizeLocator(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  const candidate = upper.length > 8 ? upper.slice(0, 8) : upper;
  return [4, 6, 8].includes(candidate.length) && MAIDENHEAD_REGEX.test(candidate) ? candidate : undefined;
}

function toLatLon(locator: string | undefined): { lat: number; lon: number } | undefined {
  if (!locator) return undefined;
  try {
    return maidenheadToLatLon(locator);
  } catch {
    return undefined;
  }
}

function normalizeReport(report: RawReceptionReport): PropagationSpot | null {
  const band = classifyBand(report.frequency / 1000);
  if (!band) return null;

  const txGrid = normalizeLocator(report.senderLocator);
  const rxGrid = normalizeLocator(report.receiverLocator);
  const txPoint = toLatLon(txGrid);
  const rxPoint = toLatLon(rxGrid);

  const candidate = {
    id: `pskReporter-${report.senderCallsign}-${report.receiverCallsign}-${report.frequency}-${report.flowStartSeconds}`,
    timestamp: new Date(report.flowStartSeconds * 1000).toISOString(),
    source: "pskReporter" as const,
    band,
    frequencyKhz: report.frequency / 1000,
    mode: report.mode,
    txCall: report.senderCallsign,
    rxCall: report.receiverCallsign,
    txGrid,
    rxGrid,
    txLat: txPoint?.lat,
    txLon: txPoint?.lon,
    rxLat: rxPoint?.lat,
    rxLon: rxPoint?.lon,
    snr: report.sNR,
    isAutomated: true,
  };

  // PSKReporter is untrusted external input (AGENTS.md) - reject a
  // malformed record rather than letting it through in a guessed shape.
  const parsed = PropagationSpotSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export interface FetchPskReporterOptions {
  grid: string;
  windowMinutes: number;
  contactEmail?: string;
}

export async function fetchPskReporterSpots(options: FetchPskReporterOptions): Promise<PropagationSpot[]> {
  const windowSeconds = Math.min(options.windowMinutes, MAX_WINDOW_MINUTES) * 60;
  const params = new URLSearchParams({
    callsign: options.grid,
    modify: "grid",
    rronly: "1",
    flowStartSeconds: String(-windowSeconds),
    callback: JSONP_CALLBACK_NAME,
  });
  if (options.contactEmail) params.set("appcontact", options.contactEmail);

  const response = await fetch(`${QUERY_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`PSKReporter request failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  const parsed = unwrapJsonp(body);
  const reports = parsed.receptionReport ?? [];

  const spots: PropagationSpot[] = [];
  for (const report of reports) {
    const spot = normalizeReport(report);
    if (spot) spots.push(spot);
  }
  return spots;
}
