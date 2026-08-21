import type { PropagationSpot } from "@hf-conditions/shared";
import {
  buildPskReporterQueryUrl,
  normalizePskReporterReport,
  unwrapPskReporterJsonp,
} from "@hf-conditions/core";

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
//
// The pure query-building/response-parsing pieces live in
// `@hf-conditions/core`'s `external/pskreporter-format.ts` so they're shared
// with the experimental browser-side live client
// (apps/web/src/adapters/pskreporter-live.ts) - this file only owns the
// Node-specific transport (`fetch` with a descriptive User-Agent).
const JSONP_CALLBACK_NAME = "hfConditionsCollector";
// DEVIATIONS.md: a 403 from a real GitHub Actions run (unseen locally -
// datacenter IPs get treated differently than a home network) - PSKReporter's
// own developer docs ask automated clients to identify themselves via
// `appcontact` precisely so an operator can tell a legitimate automated
// client from generic bot traffic. A descriptive User-Agent is the same
// idea. Neither is guaranteed to fix an ASN-level block, but both are free
// and exactly what PSKReporter's own docs ask for.
const USER_AGENT = "HF-Conditions-Collector/1.0 (+https://github.com/tommy-quitt/HF-conditions)";

export interface FetchPskReporterOptions {
  grid: string;
  windowMinutes: number;
  contactEmail?: string;
}

export async function fetchPskReporterSpots(options: FetchPskReporterOptions): Promise<PropagationSpot[]> {
  const url = buildPskReporterQueryUrl({
    grid: options.grid,
    windowMinutes: options.windowMinutes,
    contactEmail: options.contactEmail,
    callbackName: JSONP_CALLBACK_NAME,
  });

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`PSKReporter request failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  const parsed = unwrapPskReporterJsonp(body);
  const reports = parsed.receptionReport ?? [];

  const spots: PropagationSpot[] = [];
  for (const report of reports) {
    const spot = normalizePskReporterReport(report);
    if (spot) spots.push(spot);
  }
  return spots;
}
