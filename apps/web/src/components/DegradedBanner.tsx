import type { HealthResponse } from "@hf-conditions/shared";

// SPEC.md §26: "UI must indicate 'Data source degraded' when appropriate" -
// never silently show stale data as current.
export function DegradedBanner({ health }: { health: HealthResponse | null }): React.ReactElement | null {
  if (!health) return null;
  const troubled = health.sources.filter((source) => source.status !== "connected");
  if (troubled.length === 0) return null;

  return (
    <div className="degraded-banner" role="status">
      Data source degraded: {troubled.map((source) => `${source.source} (${source.status})`).join(", ")}
    </div>
  );
}
