import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baseCallsign, locateCallsign } from "../../scripts/adapters/callsign-location.js";
import { parseRbnLine } from "../../scripts/adapters/rbn.js";

describe("parseRbnLine", () => {
  it("parses a real CW skimmer spot line", () => {
    const raw = parseRbnLine("DX de CT1EYQ-#: 14030.00  KH6M           CW    12 dB  26 WPM  CQ      0630Z");
    expect(raw).toEqual({
      skimmerCall: "CT1EYQ-#",
      spottedCall: "KH6M",
      frequencyKhz: 14030,
      mode: "CW",
      snr: 12,
      hour: 6,
      minute: 30,
    });
  });

  it("parses a spot line without SNR", () => {
    const raw = parseRbnLine("DX de W1NT-2-#: 14030.00  KH6M           CW  25 WPM  CQ      0630Z");
    expect(raw?.snr).toBeUndefined();
    expect(raw?.skimmerCall).toBe("W1NT-2-#");
  });

  it("returns null for the login prompt and banner lines", () => {
    expect(parseRbnLine("Please enter your call: ")).toBeNull();
    expect(parseRbnLine("Hello, N0CALL! Connected.")).toBeNull();
    expect(parseRbnLine("")).toBeNull();
  });
});

describe("baseCallsign", () => {
  it("strips RBN skimmer suffixes", () => {
    expect(baseCallsign("CT1EYQ-#")).toBe("CT1EYQ");
    expect(baseCallsign("AC0C-1-#")).toBe("AC0C");
  });

  it("strips portable suffixes", () => {
    expect(baseCallsign("F5GPE/P")).toBe("F5GPE");
    expect(baseCallsign("K2PO/7")).toBe("K2PO");
  });
});

describe("locateCallsign", () => {
  it("resolves a known prefix to its representative coordinate", () => {
    expect(locateCallsign("DL5YAD")).toEqual({ lat: 51, lon: 10 });
  });

  it("prefers the more specific of two overlapping prefixes", () => {
    expect(locateCallsign("BV1AB")).toEqual({ lat: 24, lon: 121 });
    expect(locateCallsign("BY1AB")).toEqual({ lat: 35, lon: 105 });
  });

  it("returns undefined for an unrecognized prefix rather than guessing", () => {
    expect(locateCallsign("ZZZZZZ")).toBeUndefined();
  });
});

// fetchRbnSpots drives a real node:net socket - exercised here against a
// fake in-memory socket (rather than mocking fetch like the HTTP adapters)
// since it's a Telnet session, not a request/response call.
vi.mock("node:net", () => {
  return { default: { createConnection: vi.fn() } };
});

describe("fetchRbnSpots", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("logs in after the call prompt and normalizes streamed spot lines", async () => {
    const net = await import("node:net");
    const socket = new EventEmitter() as EventEmitter & { write: (data: string) => void; destroy: () => void };
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    (net.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(socket);

    const { fetchRbnSpots } = await import("../../scripts/adapters/rbn.js");
    const now = new Date("2026-08-21T06:31:00.000Z");
    const promise = fetchRbnSpots({ callsign: "N0CALL", collectMs: 5000, now });

    socket.emit("connect");
    socket.emit("data", Buffer.from("Please enter your call: "));
    expect(socket.write).toHaveBeenCalledWith("N0CALL\r\n");

    socket.emit(
      "data",
      Buffer.from(
        "DX de CT1EYQ-#: 14030.00  KH6M           CW    12 dB  26 WPM  CQ      0630Z\r\n" +
          "DX de RU9CZD-#: 14018.90  F5GPE/P        CW     8 dB  16 WPM  CQ      0630Z\r\n",
      ),
    );
    socket.emit("close");

    const spots = await promise;
    expect(spots).toHaveLength(2);
    expect(spots[0]).toMatchObject({
      source: "rbn",
      band: "20m",
      txCall: "KH6M",
      rxCall: "CT1EYQ",
      snr: 12,
      isAutomated: true,
    });
    expect(spots[0]?.rxLat).toBe(39);
    expect(spots[0]?.txLat).toBe(21.3);
  });

  it("rejects when the socket errors", async () => {
    const net = await import("node:net");
    const socket = new EventEmitter() as EventEmitter & { write: (data: string) => void; destroy: () => void };
    socket.write = vi.fn();
    socket.destroy = vi.fn();
    (net.default.createConnection as ReturnType<typeof vi.fn>).mockReturnValue(socket);

    const { fetchRbnSpots } = await import("../../scripts/adapters/rbn.js");
    const promise = fetchRbnSpots({ callsign: "N0CALL" });

    socket.emit("error", new Error("connect ECONNREFUSED"));

    await expect(promise).rejects.toThrow("connect ECONNREFUSED");
  });
});
