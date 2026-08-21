import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNoaaSolarObservation } from "../../scripts/adapters/noaa.js";

const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const F107_URL = "https://services.swpc.noaa.gov/json/f107_cm_flux.json";

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

describe("fetchNoaaSolarObservation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("combines the last (oldest-first) Kp entry with the first (newest-first) F10.7 entry", async () => {
    stubFetch((url) => {
      if (url === KP_URL) {
        return Promise.resolve(
          jsonResponse([
            { time_tag: "2026-08-20T00:00:00", Kp: 2.0 },
            { time_tag: "2026-08-20T03:00:00", Kp: 3.5 },
          ]),
        );
      }
      if (url === F107_URL) {
        return Promise.resolve(
          jsonResponse([
            { time_tag: "2026-08-19T22:00:00", flux: 125.0 },
            { time_tag: "2026-08-19T20:00:00", flux: 126.0 },
          ]),
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const observation = await fetchNoaaSolarObservation();

    expect(observation.kp).toBe(3.5);
    expect(observation.f107).toBe(125.0);
    expect(observation.source).toBe("noaa");
    // The Kp reading is the more recent of the two, so it wins observedAt.
    expect(observation.observedAt).toBe("2026-08-20T03:00:00Z");
  });

  it("throws when the NOAA feed responds with a non-OK status", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(null, false)));

    await expect(fetchNoaaSolarObservation()).rejects.toThrow();
  });

  it("throws when a feed returns an empty array", async () => {
    stubFetch((url) => {
      if (url === KP_URL) return Promise.resolve(jsonResponse([]));
      return Promise.resolve(jsonResponse([{ time_tag: "2026-08-19T22:00:00", flux: 125.0 }]));
    });

    await expect(fetchNoaaSolarObservation()).rejects.toThrow("no entries");
  });
});
