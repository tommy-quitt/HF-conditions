import { z } from "zod";
import type { Band, ConditionCell, Qth, Region } from "@hf-conditions/shared";

// SPEC.md §21/§24: trend needs "the score 15 minutes ago". SPEC.md models
// that as a server-side condition_snapshots table; per DEVIATIONS.md this
// app scores client-side per viewer QTH, so there's no server to hold that
// history - it's kept in the browser's own localStorage instead, scoped per
// QTH (so switching QTH doesn't compare scores across two different
// locations). Kept thin and failure-tolerant, matching qth-storage.ts:
// localStorage can be unavailable (private browsing, disabled storage) and
// that must never break the app or fabricate a trend (SPEC.md §27, core's
// trend() already returns null rather than "stable" without real history).
const STORAGE_PREFIX = "hf-conditions:score-history:";
// Slightly more than the 15-minute comparison window so a run of missed
// refreshes doesn't strand no-longer-useful entries indefinitely.
const RETENTION_MINUTES = 20;
const TARGET_MINUTES_AGO = 15;
// Refreshes happen every 5 minutes (App.tsx) - a tolerance wider than that
// interval means "the closest snapshot we actually have" still counts as
// "15 minutes ago" even if a refresh was missed or ran a little early/late.
const LOOKUP_TOLERANCE_MINUTES = 3;

const HistoryEntrySchema = z.object({
  t: z.number(),
  band: z.string(),
  region: z.string(),
  score: z.number(),
});
const HistorySchema = z.array(HistoryEntrySchema);
type HistoryEntry = z.infer<typeof HistoryEntrySchema>;

function qthKey(qth: Qth): string {
  return qth.grid ?? `${qth.lat.toFixed(2)},${qth.lon.toFixed(2)}`;
}

function loadHistory(qth: Qth): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${qthKey(qth)}`);
    if (!raw) return [];
    const parsed = HistorySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function saveHistory(qth: Qth, entries: readonly HistoryEntry[]): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${qthKey(qth)}`, JSON.stringify(entries));
  } catch {
    // No persistence this session; trend just stays null until it works again.
  }
}

// Call once per refresh, after computing the current cells, so the *next*
// refresh has something to compare against.
export function recordScores(qth: Qth, cells: readonly ConditionCell[], now: Date): void {
  const cutoffMs = now.getTime() - RETENTION_MINUTES * 60_000;
  const existing = loadHistory(qth).filter((entry) => entry.t >= cutoffMs);
  const fresh = cells.map((cell) => ({ t: now.getTime(), band: cell.band, region: cell.region, score: cell.score }));
  saveHistory(qth, [...existing, ...fresh]);
}

// Returns the score recorded closest to 15 minutes ago for this band/region,
// within a tolerance window, or null when nothing qualifies (SPEC.md §21:
// "not enough history yet" must stay null, never a guessed "stable").
export function lookupPreviousScore(qth: Qth, band: Band, region: Region, now: Date): number | null {
  const targetMs = now.getTime() - TARGET_MINUTES_AGO * 60_000;
  const toleranceMs = LOOKUP_TOLERANCE_MINUTES * 60_000;

  let closest: HistoryEntry | null = null;
  let closestDelta = Infinity;
  for (const entry of loadHistory(qth)) {
    if (entry.band !== band || entry.region !== region) continue;
    const delta = Math.abs(entry.t - targetMs);
    if (delta <= toleranceMs && delta < closestDelta) {
      closest = entry;
      closestDelta = delta;
    }
  }
  return closest ? closest.score : null;
}
