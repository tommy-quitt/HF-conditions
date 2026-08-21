import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPskReporterSpots } from "../../scripts/adapters/pskreporter.js";

function jsonpResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve(`hfConditionsCollector(${JSON.stringify(body)})`),
  } as Response;
}

function stubFetch(impl: (url: string) => Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(impl));
}

describe("fetchPskReporterSpots", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a reception report into a validated PropagationSpot", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonpResponse({
          receptionReport: [
            {
              receiverCallsign: "4X4ZP",
              receiverLocator: "KM72OR",
              senderCallsign: "OE3DXA",
              senderLocator: "JN88IC",
              frequency: 28075095,
              flowStartSeconds: 1787225921,
              mode: "FT8",
              sNR: 1,
            },
          ],
        }),
      ),
    );

    const spots = await fetchPskReporterSpots({ grid: "KM72", windowMinutes: 15 });

    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({
      source: "pskReporter",
      band: "10m",
      txCall: "OE3DXA",
      rxCall: "4X4ZP",
      txGrid: "JN88IC",
      rxGrid: "KM72OR",
      isAutomated: true,
      snr: 1,
    });
    expect(spots[0]?.txLat).toBeCloseTo(48.1, 1);
  });

  it("drops a report whose frequency doesn't classify into a supported band", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonpResponse({
          receptionReport: [
            {
              receiverCallsign: "A",
              senderCallsign: "B",
              frequency: 50313000, // 6m - not a supported band
              flowStartSeconds: 1787225921,
              mode: "FT8",
            },
          ],
        }),
      ),
    );

    const spots = await fetchPskReporterSpots({ grid: "KM72", windowMinutes: 15 });
    expect(spots).toHaveLength(0);
  });

  it("truncates an over-precise locator to 8 characters rather than dropping it", async () => {
    stubFetch(() =>
      Promise.resolve(
        jsonpResponse({
          receptionReport: [
            {
              receiverCallsign: "4X4ZP",
              receiverLocator: "KM72OR12",
              senderCallsign: "UX3HX",
              senderLocator: "KN79go61ab",
              frequency: 28075537,
              flowStartSeconds: 1787225907,
              mode: "FT8",
            },
          ],
        }),
      ),
    );

    const spots = await fetchPskReporterSpots({ grid: "KM72", windowMinutes: 15 });
    expect(spots[0]?.txGrid).toBe("KN79GO61");
  });

  it("throws on a malformed (non-JSONP) response", async () => {
    stubFetch(() => Promise.resolve({ ok: true, status: 200, statusText: "OK", text: () => Promise.resolve("not jsonp") } as Response));
    await expect(fetchPskReporterSpots({ grid: "KM72", windowMinutes: 15 })).rejects.toThrow();
  });
});
