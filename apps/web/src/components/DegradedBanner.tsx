import type { HealthResponse } from "@hf-conditions/shared";

// SPEC.md §25/§26: the collector runs on a schedule (~10-15 min per
// DEVIATIONS.md), so a run being merely a bit old is normal; a run being
// much older than that means the scheduled workflow itself has stopped
// running (or the fetch is serving a cached/stale copy) - worth its own
// warning distinct from "a specific source is degraded", since every source
// could individually say "connected" from a health.json that's hours old.
const STALE_RUN_MINUTES = 30;

// SPEC.md §26: "UI must indicate 'Data source degraded' when appropriate" -
// never silently show stale data as current.
export function DegradedBanner({
  health,
  now,
}: {
  health: HealthResponse | null;
  now: Date;
}): React.ReactElement | null {
  if (!health) return null;

  const troubled = health.sources.filter((source) => source.status !== "connected");
  const runAgeMinutes = (now.getTime() - new Date(health.generatedAt).getTime()) / 60_000;
  const staleRun = runAgeMinutes > STALE_RUN_MINUTES;

  if (troubled.length === 0 && !staleRun) return null;

  return (
    <div className="degraded-banner" role="status">
      {staleRun && <p>Last collection run was {Math.round(runAgeMinutes)} minutes ago - data may be stale.</p>}
      {troubled.length > 0 && (
        <p>Data source degraded: {troubled.map((source) => `${source.source} (${source.status})`).join(", ")}</p>
      )}
    </div>
  );
}
