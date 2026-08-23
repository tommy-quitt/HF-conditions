import { describe, expect, it } from "vitest";
import {
  buildPskReporterQueryUrl,
  unwrapPskReporterJsonp,
} from "@hf-conditions/core";

describe("buildPskReporterQueryUrl", () => {
  it("scopes the query to the given grid and clamps the window to 24h", () => {
    const url = buildPskReporterQueryUrl({
      grid: "KM72",
      windowMinutes: 15,
      callbackName: "cb",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://retrieve.pskreporter.info/query");
    expect(parsed.searchParams.get("callsign")).toBe("KM72");
    expect(parsed.searchParams.get("modify")).toBe("grid");
    expect(parsed.searchParams.get("flowStartSeconds")).toBe(String(-15 * 60));
    expect(parsed.searchParams.get("callback")).toBe("cb");
    expect(parsed.searchParams.has("appcontact")).toBe(false);
  });

  it("caps the window at 24 hours even when asked for more", () => {
    const url = buildPskReporterQueryUrl({ grid: "KM72", windowMinutes: 48 * 60, callbackName: "cb" });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("flowStartSeconds")).toBe(String(-24 * 60 * 60));
  });

  it("includes appcontact only when a contact email is supplied", () => {
    const url = buildPskReporterQueryUrl({
      grid: "KM72",
      windowMinutes: 15,
      contactEmail: "ops@example.com",
      callbackName: "cb",
    });
    expect(new URL(url).searchParams.get("appcontact")).toBe("ops@example.com");
  });
});

describe("unwrapPskReporterJsonp", () => {
  it("parses the JSON payload out of the JSONP wrapper", () => {
    const parsed = unwrapPskReporterJsonp('cb({"receptionReport":[]})');
    expect(parsed).toEqual({ receptionReport: [] });
  });

  it("throws when the body isn't a JSONP wrapper", () => {
    expect(() => unwrapPskReporterJsonp("not jsonp")).toThrow();
  });
});
