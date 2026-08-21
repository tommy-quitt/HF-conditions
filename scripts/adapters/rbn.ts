import net from "node:net";
import type { PropagationSpot } from "@hf-conditions/shared";
import { PropagationSpotSchema } from "@hf-conditions/shared";
import { classifyBand } from "@hf-conditions/core";
import { baseCallsign, locateCallsign } from "./callsign-location.js";

// SPEC.md §7.3, adapted per DEVIATIONS.md: RBN has no live HTTP alternative
// (only previous-day zip archives), so this is a short connect-collect-
// disconnect Telnet burst each scheduled run rather than the persistent
// connection SPEC.md §7.3/§33 assumes. Verified live against
// telnet.reversebeacon.net:7000 (the CW/RTTY skimmer aggregate feed): after
// connecting, the server prompts "Please enter your call: ", then streams
// lines shaped like:
//   DX de CT1EYQ-#: 14030.00  KH6M           CW    12 dB  26 WPM  CQ      0630Z
// ("DX de <skimmer>: <freq kHz>  <spotted call>  <mode>  <SNR> dB  ... <HHMM>Z").
// The FT8 feed SPEC.md §7.3 calls out as "where useful" runs on a separate
// port and is deliberately not collected in V1 - CW/RTTY skimmer coverage
// alone already gives independent reception evidence distinct from
// PSKReporter's (mostly FT8) automated reports; adding the FT8 feed is
// future work, not a silent gap (documented in DEVIATIONS.md).
const DEFAULT_HOST = "telnet.reversebeacon.net";
const DEFAULT_PORT = 7000;
// SPEC.md §7.3's ~60-90s connect/collect/disconnect window.
const DEFAULT_COLLECT_MS = 75_000;
const CONNECT_TIMEOUT_MS = 15_000;

const CALL_LOGIN_PROMPT = /call/i;
const SPOT_LINE = /^DX de (\S+):\s+([\d.]+)\s+(\S+)\s+(\S+)(?:\s+(-?\d+)\s*dB)?.*?(\d{2})(\d{2})Z\s*$/;

export interface RawRbnSpot {
  skimmerCall: string;
  spottedCall: string;
  frequencyKhz: number;
  mode: string;
  snr?: number;
  hour: number;
  minute: number;
}

// Exported for testing: pure parsing of one already-line-split chunk of the
// RBN Telnet feed, independent of the socket itself.
export function parseRbnLine(line: string): RawRbnSpot | null {
  const match = SPOT_LINE.exec(line.trim());
  if (!match) return null;
  const [, skimmerCall, freq, spottedCall, mode, snr, hour, minute] = match;
  if (!skimmerCall || !freq || !spottedCall || !mode || !hour || !minute) return null;

  return {
    skimmerCall,
    spottedCall,
    frequencyKhz: Number(freq),
    mode,
    snr: snr !== undefined ? Number(snr) : undefined,
    hour: Number(hour),
    minute: Number(minute),
  };
}

// RBN's line only carries an HH:MM (UTC) timestamp, not a date - it's
// always "now" relative to this short-lived collection burst, so combine it
// with the current UTC date rather than inventing a stored date.
function toIsoTimestamp(hour: number, minute: number, collectedAt: Date): string {
  const timestamp = new Date(
    Date.UTC(collectedAt.getUTCFullYear(), collectedAt.getUTCMonth(), collectedAt.getUTCDate(), hour, minute),
  );
  // A spot timestamped 23:5x UTC seen just after local midnight UTC-rollover
  // belongs to the previous day, not "collectedAt"'s day.
  if (timestamp.getTime() - collectedAt.getTime() > 5 * 60 * 1000) {
    timestamp.setUTCDate(timestamp.getUTCDate() - 1);
  }
  return timestamp.toISOString();
}

function toPropagationSpot(raw: RawRbnSpot, collectedAt: Date): PropagationSpot | null {
  const band = classifyBand(raw.frequencyKhz);
  if (!band) return null;

  const skimmerCall = baseCallsign(raw.skimmerCall);
  const spottedCall = baseCallsign(raw.spottedCall);
  const skimmerPoint = locateCallsign(raw.skimmerCall);
  const spottedPoint = locateCallsign(raw.spottedCall);
  const timestamp = toIsoTimestamp(raw.hour, raw.minute, collectedAt);

  const candidate = {
    // Include minute-truncated fields, not the raw skimmer string (which
    // carries a "-#"/"-1-#" suffix that isn't part of the identity), so
    // re-running collection against the same spot doesn't mint a new id.
    id: `rbn-${skimmerCall}-${spottedCall}-${raw.frequencyKhz}-${timestamp}`,
    timestamp,
    source: "rbn" as const,
    band,
    frequencyKhz: raw.frequencyKhz,
    mode: raw.mode,
    // RBN spots record a skimmer receiving a spotted station - the spotted
    // call is transmitting, the skimmer is receiving.
    txCall: spottedCall,
    rxCall: skimmerCall,
    txLat: spottedPoint?.lat,
    txLon: spottedPoint?.lon,
    rxLat: skimmerPoint?.lat,
    rxLon: skimmerPoint?.lon,
    snr: raw.snr,
    isAutomated: true,
  };

  // RBN is untrusted external input (AGENTS.md) - reject a malformed record
  // rather than letting it through in a guessed shape.
  const parsed = PropagationSpotSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export interface FetchRbnOptions {
  callsign: string;
  host?: string;
  port?: number;
  collectMs?: number;
  now?: Date;
}

// Connects, logs in with `callsign` (RBN requires a real callsign to
// connect - configure via HF_RBN_CALLSIGN per AGENTS.md's "hostnames/ports
// are configuration, not hardcoded"), collects for `collectMs`, then
// disconnects. One socket-level failure (refused/reset/timeout - e.g. if
// GitHub Actions' shared runner IPs turn out to be blocked, the open risk
// TASKS.md step 8 called out) rejects the whole call so collect.ts's
// existing per-source try/catch can mark RBN degraded/disconnected and
// renormalize, exactly like a PSKReporter/HolyCluster HTTP failure.
export function fetchRbnSpots(options: FetchRbnOptions): Promise<PropagationSpot[]> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const collectMs = options.collectMs ?? DEFAULT_COLLECT_MS;
  const collectedAt = options.now ?? new Date();

  return new Promise<PropagationSpot[]>((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: CONNECT_TIMEOUT_MS });
    const spots: PropagationSpot[] = [];
    let loggedIn = false;
    let buffer = "";
    let settled = false;
    let collectTimer: NodeJS.Timeout | undefined;

    function finish(): void {
      if (settled) return;
      settled = true;
      if (collectTimer) clearTimeout(collectTimer);
      socket.destroy();
      resolve(spots);
    }

    function fail(error: Error): void {
      if (settled) return;
      settled = true;
      if (collectTimer) clearTimeout(collectTimer);
      socket.destroy();
      reject(error);
    }

    socket.on("connect", () => {
      collectTimer = setTimeout(finish, collectMs);
    });

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("latin1");

      if (!loggedIn && CALL_LOGIN_PROMPT.test(buffer)) {
        loggedIn = true;
        socket.write(`${options.callsign}\r\n`);
        buffer = "";
        return;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const raw = parseRbnLine(line);
        if (!raw) continue;
        const spot = toPropagationSpot(raw, collectedAt);
        if (spot) spots.push(spot);
      }
    });

    socket.on("timeout", () => fail(new Error(`RBN connection to ${host}:${port} timed out`)));
    socket.on("error", (error) => fail(error));
    socket.on("close", () => finish());
  });
}
