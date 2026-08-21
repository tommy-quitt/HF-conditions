import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HealthResponseSchema, SolarObservationSchema } from "@hf-conditions/shared";
import {
  readDataSourceHealth,
  readJsonFile,
  readLatestSolarObservation,
  upsertDataSourceHealth,
  writeJsonFile,
  writeLatestSolarObservation,
} from "@hf-conditions/data-io";

describe("json-store", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "hf-conditions-data-io-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns null when the file does not exist", async () => {
    const value = await readJsonFile(path.join(dir, "missing.json"), SolarObservationSchema);
    expect(value).toBeNull();
  });

  it("round-trips a value through write then read, validated by its schema", async () => {
    const observation = { observedAt: "2026-08-20T12:00:00.000Z", f107: 125, kp: 2.0, source: "noaa" as const };
    const filePath = path.join(dir, "solar.json");

    await writeLatestSolarObservation(filePath, observation);
    const readBack = await readLatestSolarObservation(filePath);

    expect(readBack).toEqual(observation);
  });

  it("rejects a value that fails its schema", async () => {
    const filePath = path.join(dir, "bad.json");
    await expect(
      writeJsonFile(filePath, { f107: -5, kp: 2, source: "noaa", observedAt: "not-a-date" }, SolarObservationSchema),
    ).rejects.toThrow();
  });
});

describe("health-store", () => {
  let dir: string;
  let healthPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "hf-conditions-data-io-"));
    healthPath = path.join(dir, "health.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("upserts one source without disturbing another", async () => {
    await upsertDataSourceHealth(
      healthPath,
      { source: "noaa", status: "connected", lastObservationAt: "2026-08-20T12:00:00.000Z", eventsLastFiveMinutes: 1 },
      "2026-08-20T12:00:00.000Z",
    );
    await upsertDataSourceHealth(
      healthPath,
      { source: "rbn", status: "disconnected", lastObservationAt: null, eventsLastFiveMinutes: 0 },
      "2026-08-20T12:05:00.000Z",
    );

    const noaa = await readDataSourceHealth(healthPath, "noaa");
    const rbn = await readDataSourceHealth(healthPath, "rbn");
    expect(noaa?.status).toBe("connected");
    expect(rbn?.status).toBe("disconnected");
  });

  it("replaces a stale entry for the same source rather than duplicating it", async () => {
    await upsertDataSourceHealth(
      healthPath,
      { source: "noaa", status: "connected", lastObservationAt: "2026-08-20T12:00:00.000Z", eventsLastFiveMinutes: 1 },
      "2026-08-20T12:00:00.000Z",
    );
    const result = await upsertDataSourceHealth(
      healthPath,
      { source: "noaa", status: "degraded", lastObservationAt: "2026-08-20T12:00:00.000Z", eventsLastFiveMinutes: 0 },
      "2026-08-20T12:05:00.000Z",
    );

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]?.status).toBe("degraded");
  });

  it("writes a schema-valid health.json", async () => {
    await upsertDataSourceHealth(
      healthPath,
      { source: "noaa", status: "connected", lastObservationAt: "2026-08-20T12:00:00.000Z", eventsLastFiveMinutes: 1 },
      "2026-08-20T12:00:00.000Z",
    );
    const raw = await readJsonFile(healthPath, HealthResponseSchema);
    expect(raw).not.toBeNull();
  });
});
