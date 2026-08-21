import { pathToFileURL } from "node:url";
import type { PropagationSpot, SpotSource } from "@hf-conditions/shared";
import {
  appendAggregateBuckets,
  readDataSourceHealth,
  readLatestSolarObservation,
  resolveDataPath,
  upsertDataSourceHealth,
  writeLatestSolarObservation,
} from "@hf-conditions/data-io";
import { RECENCY_MAX_AGE_MINUTES, bucketSpots, createRegionResolver, maidenheadToLatLon } from "@hf-conditions/core";
import { fetchHolyClusterSpots } from "./adapters/holycluster.js";
import { fetchNoaaSolarObservation } from "./adapters/noaa.js";
import { fetchPskReporterSpots } from "./adapters/pskreporter.js";
import { fetchRbnSpots } from "./adapters/rbn.js";

// Entry point run by the GitHub Actions collection workflow (and locally via
// `npm run collect`). Per DEVIATIONS.md, this script only fetches,
// normalizes and writes the committed JSON files - committing/pushing the
// result is the calling workflow's job (step 10), so this runs identically
// locally and in CI.
//
// Each source is collected through its own try/catch: one source failing
// must never affect another, and must never be silently treated as
// connected/fresh (SPEC.md §26, AGENTS.md).
const DATA_DIR = process.env.HF_DATA_DIR ?? "data";

// DEVIATIONS.md: V1 fixed-QTH simplification for PSKReporter, since its
// query API is grid-scoped rather than a global firehose. HolyCluster has
// no such limitation - it's used here for consistency across sources in
// V1, not because it needs to be.
const HOME_GRID = process.env.HF_HOME_GRID ?? "KM72";
const QTH = maidenheadToLatLon(HOME_GRID);
// DXCC table is intentionally empty (TASKS.md step 3) - region
// classification for these spots relies on coordinates via the coordinate
// resolver.
const REGION_RESOLVER = createRegionResolver({ dxccTable: [] });

const PSK_REPORTER_WINDOW_MINUTES = 15;
const HOLYCLUSTER_WINDOW_MINUTES = 15;

// SPEC.md §7.3/DEVIATIONS.md: RBN requires logging in with a real callsign
// (there's no anonymous/global query like HolyCluster's) - unlike the fixed
// PSKReporter home grid, there's no sensible hardcoded default here, so RBN
// collection is skipped (not attempted with a fabricated callsign) when
// this isn't configured.
const RBN_CALLSIGN = process.env.HF_RBN_CALLSIGN;
const RBN_HOST = process.env.HF_RBN_HOST;
const RBN_PORT = process.env.HF_RBN_PORT ? Number(process.env.HF_RBN_PORT) : undefined;
const RBN_COLLECT_MS = process.env.HF_RBN_COLLECT_MS ? Number(process.env.HF_RBN_COLLECT_MS) : undefined;

function log(level: "info" | "error", message: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...fields }));
}

// Exported for testing (SPEC.md §30's "stale NOAA data" scenario in
// particular needs to exercise this fallback path in isolation, without
// running the whole real collection pipeline main() does).
export async function collectNoaa(generatedAt: string): Promise<void> {
  const solarPath = resolveDataPath("solar.json", DATA_DIR);
  const healthPath = resolveDataPath("health.json", DATA_DIR);

  try {
    const observation = await fetchNoaaSolarObservation();
    await writeLatestSolarObservation(solarPath, observation);
    await upsertDataSourceHealth(
      healthPath,
      {
        source: "noaa",
        status: "connected",
        lastObservationAt: observation.observedAt,
        eventsLastFiveMinutes: 1,
      },
      generatedAt,
    );
    log("info", "NOAA solar observation collected", { f107: observation.f107, kp: observation.kp });
  } catch (error) {
    // SPEC.md §26: retain the last known value on disk untouched; only
    // update health so the UI can show the source as degraded/disconnected
    // instead of silently going stale.
    const lastKnown = await readLatestSolarObservation(solarPath).catch(() => null);
    await upsertDataSourceHealth(
      healthPath,
      {
        source: "noaa",
        status: lastKnown ? "degraded" : "disconnected",
        lastObservationAt: lastKnown?.observedAt ?? null,
        eventsLastFiveMinutes: 0,
      },
      generatedAt,
    );
    log("error", "NOAA collection failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

// Shared by every raw-spot source (PSKReporter, DX Cluster, and RBN once it
// lands): fetch → bucket against the fixed home QTH → append to the rolling
// aggregate history → report health, all isolated from every other source.
export async function collectSpotSource(
  generatedAt: string,
  source: SpotSource,
  fetchSpots: () => Promise<PropagationSpot[]>,
  extraLogFields: Record<string, unknown> = {},
): Promise<void> {
  const aggregatesPath = resolveDataPath("aggregates.json", DATA_DIR);
  const healthPath = resolveDataPath("health.json", DATA_DIR);
  const generatedAtMs = new Date(generatedAt).getTime();

  try {
    const spots = await fetchSpots();

    const buckets = bucketSpots({ spots, qth: QTH, regionResolver: REGION_RESOLVER });
    await appendAggregateBuckets(aggregatesPath, buckets, RECENCY_MAX_AGE_MINUTES, new Date(generatedAt));

    const recentSpotCount = spots.filter(
      (spot) => generatedAtMs - new Date(spot.timestamp).getTime() <= 5 * 60 * 1000,
    ).length;
    const latestTimestamp = spots.reduce<string | null>(
      (latest, spot) => (latest === null || spot.timestamp > latest ? spot.timestamp : latest),
      null,
    );
    const existing = await readDataSourceHealth(healthPath, source);

    await upsertDataSourceHealth(
      healthPath,
      {
        source,
        status: "connected",
        lastObservationAt: latestTimestamp ?? existing?.lastObservationAt ?? null,
        eventsLastFiveMinutes: recentSpotCount,
      },
      generatedAt,
    );
    log("info", `${source} spots collected`, { spotCount: spots.length, bucketCount: buckets.length, ...extraLogFields });
  } catch (error) {
    const existing = await readDataSourceHealth(healthPath, source);
    await upsertDataSourceHealth(
      healthPath,
      {
        source,
        status: existing ? "degraded" : "disconnected",
        lastObservationAt: existing?.lastObservationAt ?? null,
        eventsLastFiveMinutes: 0,
      },
      generatedAt,
    );
    log("error", `${source} collection failed`, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  await collectNoaa(generatedAt);
  await collectSpotSource(
    generatedAt,
    "pskReporter",
    () =>
      fetchPskReporterSpots({
        grid: HOME_GRID,
        windowMinutes: PSK_REPORTER_WINDOW_MINUTES,
        contactEmail: process.env.HF_CONTACT_EMAIL,
      }),
    { grid: HOME_GRID },
  );
  await collectSpotSource(generatedAt, "dxCluster", () =>
    fetchHolyClusterSpots({ windowMinutes: HOLYCLUSTER_WINDOW_MINUTES }),
  );

  if (RBN_CALLSIGN) {
    await collectSpotSource(generatedAt, "rbn", () =>
      fetchRbnSpots({ callsign: RBN_CALLSIGN, host: RBN_HOST, port: RBN_PORT, collectMs: RBN_COLLECT_MS }),
    );
  } else {
    log("info", "Skipping RBN collection: HF_RBN_CALLSIGN is not configured");
  }
}

// Only run main() when this file is executed directly (`npm run collect` /
// the Actions workflow) - not when tests import collectNoaa/collectSpotSource
// in isolation.
const isMain = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((error: unknown) => {
    log("error", "collect.ts crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
