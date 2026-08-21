// SPEC.md §7.3: "Resolve station locations where possible." RBN's Telnet
// feed gives only callsigns - no grid/coordinates like PSKReporter, no
// pre-resolved lat/lon like HolyCluster. The real per-station CTY/DXCC
// dataset is still deliberately deferred (TASKS.md step 3/packages/core's
// dxcc-region-resolver), so this is a small, hand-built table of
// internationally allocated callsign prefix blocks (ITU/IARU allocations -
// factual, publicly documented country assignments, not a licensed
// third-party dataset) mapped to one representative coordinate per prefix.
// It's intentionally coarse - "a reasonable approximation of where a
// callsign's country is," not a real per-station locator - consistent with
// how @hf-conditions/core's own REGION_REPRESENTATIVE_POINTS is documented
// as a coarse sanity check rather than a precise model. Longest-prefix-match
// wins, so a more specific block (e.g. "KH" Hawaii/Pacific) is tried before
// a broader one that would otherwise swallow it (e.g. "K").
interface PrefixLocation {
  prefix: string;
  lat: number;
  lon: number;
}

const PREFIX_LOCATIONS: readonly PrefixLocation[] = [
  // North America
  { prefix: "K", lat: 39, lon: -98 },
  { prefix: "W", lat: 39, lon: -98 },
  { prefix: "N", lat: 39, lon: -98 },
  { prefix: "AA", lat: 39, lon: -98 },
  { prefix: "AB", lat: 39, lon: -98 },
  { prefix: "AC", lat: 39, lon: -98 },
  { prefix: "AD", lat: 39, lon: -98 },
  { prefix: "AE", lat: 39, lon: -98 },
  { prefix: "AG", lat: 39, lon: -98 },
  { prefix: "AI", lat: 39, lon: -98 },
  { prefix: "AJ", lat: 39, lon: -98 },
  { prefix: "AK", lat: 39, lon: -98 },
  { prefix: "AL", lat: 39, lon: -98 },
  { prefix: "KL", lat: 64, lon: -153 },
  { prefix: "KH", lat: 21.3, lon: -157.8 },
  { prefix: "KP", lat: 18.2, lon: -66.5 },
  { prefix: "VE", lat: 56, lon: -106 },
  { prefix: "VA", lat: 56, lon: -106 },
  { prefix: "VO", lat: 53, lon: -60 },
  { prefix: "VY", lat: 62, lon: -114 },
  { prefix: "XE", lat: 23, lon: -102 },
  { prefix: "XF", lat: 23, lon: -102 },

  // Europe
  { prefix: "G", lat: 54, lon: -2 },
  { prefix: "M", lat: 54, lon: -2 },
  { prefix: "2E", lat: 54, lon: -2 },
  { prefix: "EI", lat: 53, lon: -8 },
  { prefix: "F", lat: 46, lon: 2 },
  { prefix: "DL", lat: 51, lon: 10 },
  { prefix: "DA", lat: 51, lon: 10 },
  { prefix: "DF", lat: 51, lon: 10 },
  { prefix: "DK", lat: 51, lon: 10 },
  { prefix: "DJ", lat: 51, lon: 10 },
  { prefix: "I", lat: 43, lon: 12 },
  { prefix: "EA", lat: 40, lon: -4 },
  { prefix: "CT", lat: 39, lon: -8 },
  { prefix: "ON", lat: 50, lon: 4 },
  { prefix: "PA", lat: 52, lon: 5 },
  { prefix: "PD", lat: 52, lon: 5 },
  { prefix: "SM", lat: 62, lon: 15 },
  { prefix: "SA", lat: 62, lon: 15 },
  { prefix: "OH", lat: 64, lon: 26 },
  { prefix: "LA", lat: 61, lon: 9 },
  { prefix: "LB", lat: 61, lon: 9 },
  { prefix: "OZ", lat: 56, lon: 10 },
  { prefix: "SP", lat: 52, lon: 19 },
  { prefix: "HB", lat: 47, lon: 8 },
  { prefix: "HE", lat: 47, lon: 8 },
  { prefix: "OE", lat: 47, lon: 14 },
  { prefix: "HA", lat: 47, lon: 19 },
  { prefix: "HG", lat: 47, lon: 19 },
  { prefix: "YO", lat: 46, lon: 25 },
  { prefix: "LZ", lat: 43, lon: 25 },
  { prefix: "SV", lat: 39, lon: 22 },
  { prefix: "9A", lat: 45, lon: 16 },
  { prefix: "OK", lat: 50, lon: 15 },
  { prefix: "OL", lat: 50, lon: 15 },
  { prefix: "OM", lat: 49, lon: 19 },
  { prefix: "UR", lat: 49, lon: 32 },
  { prefix: "UT", lat: 49, lon: 32 },
  { prefix: "UX", lat: 49, lon: 32 },
  { prefix: "ES", lat: 59, lon: 26 },
  { prefix: "YL", lat: 57, lon: 25 },
  { prefix: "LY", lat: 55, lon: 24 },
  { prefix: "4X", lat: 31.5, lon: 35 },
  { prefix: "4Z", lat: 31.5, lon: 35 },
  // European vs. Asian Russia: more specific "9"/"0" call areas are matched
  // before the generic prefix, since PREFIX_LOCATIONS is sorted longest
  // (and therefore most specific) first.
  { prefix: "UA9", lat: 60, lon: 90 },
  { prefix: "UA0", lat: 60, lon: 90 },
  { prefix: "RA9", lat: 60, lon: 90 },
  { prefix: "RA0", lat: 60, lon: 90 },
  { prefix: "R9", lat: 60, lon: 90 },
  { prefix: "R0", lat: 60, lon: 90 },
  { prefix: "UA", lat: 55.75, lon: 37.6 },
  { prefix: "RA", lat: 55.75, lon: 37.6 },
  { prefix: "R", lat: 55.75, lon: 37.6 },

  // Asia
  { prefix: "JA", lat: 36, lon: 138 },
  { prefix: "JE", lat: 36, lon: 138 },
  { prefix: "JF", lat: 36, lon: 138 },
  { prefix: "JH", lat: 36, lon: 138 },
  { prefix: "JJ", lat: 36, lon: 138 },
  { prefix: "JK", lat: 36, lon: 138 },
  { prefix: "JL", lat: 36, lon: 138 },
  { prefix: "JM", lat: 36, lon: 138 },
  { prefix: "JN", lat: 36, lon: 138 },
  { prefix: "JO", lat: 36, lon: 138 },
  { prefix: "JP", lat: 36, lon: 138 },
  { prefix: "JQ", lat: 36, lon: 138 },
  { prefix: "JR", lat: 36, lon: 138 },
  { prefix: "JS", lat: 36, lon: 138 },
  { prefix: "BV", lat: 24, lon: 121 },
  { prefix: "B", lat: 35, lon: 105 },
  { prefix: "HL", lat: 37, lon: 127 },
  { prefix: "DS", lat: 37, lon: 127 },
  { prefix: "6K", lat: 37, lon: 127 },
  { prefix: "6L", lat: 37, lon: 127 },
  { prefix: "VU", lat: 22, lon: 79 },
  { prefix: "AT", lat: 22, lon: 79 },
  { prefix: "9V", lat: 1.3, lon: 103.8 },
  { prefix: "9M", lat: 4, lon: 102 },
  { prefix: "HS", lat: 15, lon: 101 },
  { prefix: "E2", lat: 15, lon: 101 },
  { prefix: "DU", lat: 13, lon: 122 },
  { prefix: "DV", lat: 13, lon: 122 },
  { prefix: "DW", lat: 13, lon: 122 },
  { prefix: "YB", lat: -2, lon: 118 },
  { prefix: "YC", lat: -2, lon: 118 },
  { prefix: "YD", lat: -2, lon: 118 },
  { prefix: "VR", lat: 22.3, lon: 114.2 },
];

const SORTED_PREFIX_LOCATIONS = [...PREFIX_LOCATIONS].sort((a, b) => b.prefix.length - a.prefix.length);

// Strips portable ("/P", "/7", "/QRP") and RBN skimmer ("-#", "-1-#")
// suffixes down to the base callsign prefixes are matched against.
export function baseCallsign(raw: string): string {
  const withoutPortable = raw.split("/")[0] ?? raw;
  return withoutPortable.replace(/-#$/, "").replace(/-\d+$/, "").toUpperCase();
}

export interface LatLon {
  lat: number;
  lon: number;
}

export function locateCallsign(rawCallsign: string): LatLon | undefined {
  const call = baseCallsign(rawCallsign);
  const match = SORTED_PREFIX_LOCATIONS.find((entry) => call.startsWith(entry.prefix));
  return match ? { lat: match.lat, lon: match.lon } : undefined;
}
