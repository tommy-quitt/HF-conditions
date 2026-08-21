import type { PropagationSpot } from "@hf-conditions/shared";
import {
  buildPskReporterQueryUrl,
  normalizePskReporterReport,
  type RawPskReporterQueryResponse,
} from "@hf-conditions/core";

// EXPERIMENTAL - see DEVIATIONS.md. Queries PSKReporter directly from the
// browser, scoped to the *viewer's own* grid, instead of only relying on
// the collector's fixed-home-grid snapshot (scripts/adapters/pskreporter.ts,
// AGENTS.md's normal "external systems only via collector adapters" rule).
// This is a deliberate exception, isolated to this one file.
//
// `retrieve.pskreporter.info/query` does not send CORS headers (only
// verified from Node so far, where CORS doesn't apply - see AGENTS.md's
// verify-live-before-locking-in convention), so a plain browser `fetch()`
// would be blocked. Its documented `callback=` parameter is real JSONP -
// a `<script src>` tag isn't subject to CORS - so that's the transport
// used here instead of `fetch()`.
// Verified live (real browser, real query): typical round-trip is ~1s, but
// generous enough to tolerate a slow connection before falling back.
const JSONP_TIMEOUT_MS = 10000;
let callbackCounter = 0;

function loadJsonp(url: string, callbackName: string): Promise<RawPskReporterQueryResponse> {
  return new Promise((resolve, reject) => {
    const globalScope = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("PSKReporter live query timed out"));
    }, JSONP_TIMEOUT_MS);

    function cleanup(): void {
      delete globalScope[callbackName];
      script.remove();
      window.clearTimeout(timeoutId);
    }

    globalScope[callbackName] = (data: RawPskReporterQueryResponse) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("PSKReporter live query failed to load"));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

export interface FetchLivePskReporterSpotsOptions {
  grid: string;
  windowMinutes: number;
  contactEmail?: string;
}

export async function fetchLivePskReporterSpots(
  options: FetchLivePskReporterSpotsOptions,
): Promise<PropagationSpot[]> {
  const callbackName = `hfConditionsPskLive${callbackCounter++}`;
  const url = buildPskReporterQueryUrl({
    grid: options.grid,
    windowMinutes: options.windowMinutes,
    contactEmail: options.contactEmail,
    callbackName,
  });

  const parsed = await loadJsonp(url, callbackName);
  const reports = parsed.receptionReport ?? [];

  const spots: PropagationSpot[] = [];
  for (const report of reports) {
    const spot = normalizePskReporterReport(report);
    if (spot) spots.push(spot);
  }
  return spots;
}
