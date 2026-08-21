import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHolyClusterSpots } from "../../scripts/adapters/holycluster.js";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  } as Response;
}

function stubFetch(impl: (url: string) => Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("fetchHolyClusterSpots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a spot, swapping HolyCluster's [lon, lat] order and marking it human-sourced", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          spots: [
            {
              spotter_callsign: "LZ5DI",
              spotter_loc: [23.25, 42.6666],
              spotter_dxcc_code: 212,
              dx_callsign: "OE3DXA",
              dx_loc: [16.0, 48.0],
              dx_dxcc_code: 206,
              freq: 14044.1,
              mode: "CW",
              time: 1787220005,
              comment: "up 2",
            },
          ],
        }),
      ),
    );

    const spots = await fetchHolyClusterSpots({ windowMinutes: 15 });

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      source: "dxCluster",
      band: "20m",
      txCall: "OE3DXA",
      rxCall: "LZ5DI",
      txLat: 48.0,
      txLon: 16.0,
      rxLat: 42.6666,
      rxLon: 23.25,
      txDxcc: 206,
      rxDxcc: 212,
      isAutomated: false,
      spotterCall: "LZ5DI",
      comment: "up 2",
      sourceCluster: "holycluster",
    });
  });

  it("drops a spot whose frequency doesn't classify into a supported band", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          spots: [
            {
              spotter_callsign: "A",
              dx_callsign: "B",
              freq: 10368870, // SHF microwave - not a supported HF band
              mode: "SSB",
              time: 1787220005,
            },
          ],
        }),
      ),
    );

    expect(await fetchHolyClusterSpots({ windowMinutes: 15 })).toHaveLength(0);
  });

  it("defaults mode to 'unknown' when missing", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonResponse({
          spots: [{ spotter_callsign: "A", dx_callsign: "B", freq: 14074, time: 1787220005 }],
        }),
      ),
    );

    const spots = await fetchHolyClusterSpots({ windowMinutes: 15 });
    expect(spots[0]?.mode).toBe("unknown");
  });

  it("throws on a non-OK response", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(null, false)));
    await expect(fetchHolyClusterSpots({ windowMinutes: 15 })).rejects.toThrow();
  });

  it("treats a missing spots array as no spots rather than throwing", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({})));
    expect(await fetchHolyClusterSpots({ windowMinutes: 15 })).toEqual([]);
  });
});
