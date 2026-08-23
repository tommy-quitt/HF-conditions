import type { PropagationSpot } from "@hf-conditions/shared";
import { PropagationSpotSchema } from "@hf-conditions/shared";
import { classifyBand } from "../band.js";
import { maidenheadToLatLon } from "../geo/maidenhead.js";

// Pure parsing/normalization for PSKReporter's `retrieve.pskreporter.info/query`
// JSONP response shape (SPEC.md §7.2). Kept here - not in scripts/adapters -
// because it does no network/filesystem access (AGENTS.md's packages/core
// rule), which lets it run unchanged from both the Node collector adapter
// (scripts/adapters/pskreporter.ts, fixed home grid) and the experimental
// browser-side live client (apps/web/src/adapters/pskreporter-live.ts,
// per-viewer grid - see DEVIATIONS.md). Each caller supplies its own
// transport: Node `fetch`, or a browser `<script>` JSONP injection.
export const PSK_REPORTER_QUERY_URL = "https://retrieve.pskreporter.info/query";
const MAIDENHEAD_REGEX = /^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/;
const MAX_WINDOW_MINUTES = 24 * 60;

export interface RawPskReporterReceptionReport {
  receiverCallsign: string;
  receiverLocator?: string;
  senderCallsign: string;
  senderLocator?: string;
  frequency: number;
  flowStartSeconds: number;
  mode: string;
  sNR?: number;
}

export interface RawPskReporterQueryResponse {
  receptionReport?: RawPskReporterReceptionReport[];
}

export function unwrapPskReporterJsonp(body: string): RawPskReporterQueryResponse {
  const start = body.indexOf("(");
  const end = body.lastIndexOf(")");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Unexpected PSKReporter response shape: JSONP wrapper not found");
  }
  return JSON.parse(body.slice(start + 1, end)) as RawPskReporterQueryResponse;
}

export interface PskReporterQueryOptions {
  grid: string;
  windowMinutes: number;
  contactEmail?: string;
  callbackName: string;
}

// Shared query-string construction so the fixed-window/appcontact/rronly
// behavior can't drift between the Node adapter and the browser client.
export function buildPskReporterQueryUrl(options: PskReporterQueryOptions): string {
  const windowSeconds = Math.min(options.windowMinutes, MAX_WINDOW_MINUTES) * 60;
  const params = new URLSearchParams({
    callsign: options.grid,
    modify: "grid",
    rronly: "1",
    flowStartSeconds: String(-windowSeconds),
    callback: options.callbackName,
  });
  if (options.contactEmail) params.set("appcontact", options.contactEmail);
  return `${PSK_REPORTER_QUERY_URL}?${params.toString()}`;
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

export function normalizePskReporterReport(report: RawPskReporterReceptionReport): PropagationSpot | null {
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
