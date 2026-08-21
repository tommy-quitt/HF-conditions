import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readDataSourceHealth, readLatestSolarObservation, resolveDataPath } from "@hf-conditions/data-io";

// collect.ts reads HF_DATA_DIR at module load time, so it has to be set
// before the module is first imported - a fresh temp directory per test
// file keeps this isolated from a real ./data directory and from other
// test files that also import collect.ts.
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "hf-conditions-collect-test-"));
  vi.stubEnv("HF_DATA_DIR", dataDir);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dataDir, { recursive: true, force: true });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(resolveDataPath("solar.json", dataDir), { force: true });
  await rm(resolveDataPath("health.json", dataDir), { force: true });
  await rm(resolveDataPath("aggregates.json", dataDir), { force: true });
});

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, statusText: ok ? "OK" : "Internal Server Error", json: () => Promise.resolve(body) } as Response;
}

describe("collectNoaa", () => {
  it("writes solar.json and marks noaa connected on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("k-index")
            ? jsonResponse([{ time_tag: "2026-08-21T06:00:00", Kp: 2 }])
            : jsonResponse([{ time_tag: "2026-08-21T06:00:00", flux: 130 }]),
        ),
      ),
    );

    const { collectNoaa } = await import("../../scripts/collect.js");
    await collectNoaa("2026-08-21T06:05:00.000Z");

    const solar = await readLatestSolarObservation(resolveDataPath("solar.json", dataDir));
    expect(solar?.kp).toBe(2);
    const health = await readDataSourceHealth(resolveDataPath("health.json", dataDir), "noaa");
    expect(health?.status).toBe("connected");
  });

  it("SPEC.md §30: on failure, retains the last known solar observation and marks the source degraded (not disconnected, not zeroed)", async () => {
    const { collectNoaa } = await import("../../scripts/collect.js");

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("k-index")
            ? jsonResponse([{ time_tag: "2026-08-21T05:00:00", Kp: 3 }])
            : jsonResponse([{ time_tag: "2026-08-21T05:00:00", flux: 125 }]),
        ),
      ),
    );
    await collectNoaa("2026-08-21T05:05:00.000Z");

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(null, false))));
    await collectNoaa("2026-08-21T06:05:00.000Z");

    const solar = await readLatestSolarObservation(resolveDataPath("solar.json", dataDir));
    expect(solar?.kp).toBe(3); // stale value from the earlier successful run, untouched

    const health = await readDataSourceHealth(resolveDataPath("health.json", dataDir), "noaa");
    expect(health?.status).toBe("degraded");
    expect(health?.lastObservationAt).toBe(solar?.observedAt);
  });

  it("marks noaa disconnected (not degraded) when there was never a prior successful observation", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(null, false))));

    const { collectNoaa } = await import("../../scripts/collect.js");
    await collectNoaa("2026-08-21T06:05:00.000Z");

    const health = await readDataSourceHealth(resolveDataPath("health.json", dataDir), "noaa");
    expect(health?.status).toBe("disconnected");
    expect(health?.lastObservationAt).toBeNull();
  });
});

describe("collectSpotSource", () => {
  it("marks a source connected and appends its aggregate buckets on success", async () => {
    const { collectSpotSource } = await import("../../scripts/collect.js");
    await collectSpotSource("2026-08-21T06:05:00.000Z", "dxCluster", () =>
      Promise.resolve([
        {
          id: "s1",
          timestamp: "2026-08-21T06:04:00.000Z",
          source: "dxCluster",
          band: "20m",
          frequencyKhz: 14074,
          mode: "FT8",
          txCall: "A",
          rxCall: "B",
          txLat: 32,
          txLon: 35,
          rxLat: 32,
          rxLon: 35,
          isAutomated: false,
        },
      ]),
    );

    const health = await readDataSourceHealth(resolveDataPath("health.json", dataDir), "dxCluster");
    expect(health?.status).toBe("connected");
    expect(health?.eventsLastFiveMinutes).toBe(1);
  });

  it("SPEC.md §26/§30: isolates a source's failure - marks it degraded (with the prior lastObservationAt retained) rather than affecting other sources", async () => {
    const { collectSpotSource } = await import("../../scripts/collect.js");
    await collectSpotSource("2026-08-21T05:05:00.000Z", "rbn", () =>
      Promise.resolve([
        {
          id: "s1",
          timestamp: "2026-08-21T05:04:00.000Z",
          source: "rbn",
          band: "20m",
          frequencyKhz: 14030,
          mode: "CW",
          txCall: "A",
          rxCall: "B",
          isAutomated: true,
        },
      ]),
    );

    await collectSpotSource("2026-08-21T06:05:00.000Z", "rbn", () =>
      Promise.reject(new Error("connect ECONNREFUSED")),
    );

    const health = await readDataSourceHealth(resolveDataPath("health.json", dataDir), "rbn");
    expect(health?.status).toBe("degraded");
    expect(health?.lastObservationAt).toBe("2026-08-21T05:04:00.000Z");
    expect(health?.eventsLastFiveMinutes).toBe(0);
  });
});
