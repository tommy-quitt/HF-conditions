import type { ConditionCell } from "@hf-conditions/shared";
import { REGION_LABELS } from "../lib/region-labels.js";

const SOURCE_LABELS = {
  pskReporter: "PSKReporter",
  rbn: "Reverse Beacon Network",
  dxCluster: "DX Cluster",
} as const;

// SPEC.md §6: clicking a matrix cell opens a details panel with the
// component evidence behind that score - every score must be explainable.
export function DetailPanel({
  cell,
  onClose,
}: {
  cell: ConditionCell;
  onClose: () => void;
}): React.ReactElement {
  const { components, stats } = cell;

  return (
    <div className="detail-panel-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="detail-panel" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="detail-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>
          {cell.band} → {REGION_LABELS[cell.region]}
        </h2>
        <p className="detail-score">
          {cell.score} — {cell.label}
        </p>
        <p className="detail-confidence">
          Confidence: {cell.confidenceLabel} ({cell.confidence})
        </p>
        <dl className="detail-components">
          {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((source) => {
            const value = components[source];
            return (
              <div key={source}>
                <dt>{SOURCE_LABELS[source]}</dt>
                <dd>{value === null ? "no data" : Math.round(value)}</dd>
              </div>
            );
          })}
          <div>
            <dt>Solar modifier</dt>
            <dd>{components.solarModifier >= 0 ? "+" : ""}{components.solarModifier}</dd>
          </div>
          <div>
            <dt>Path modifier</dt>
            <dd>{components.pathModifier >= 0 ? "+" : ""}{components.pathModifier}</dd>
          </div>
          <div>
            <dt>Weighted reports</dt>
            <dd>{stats.weightedReports.toFixed(1)}</dd>
          </div>
          <div>
            <dt>Unique stations</dt>
            <dd>{stats.uniqueStations}</dd>
          </div>
        </dl>
        {cell.confidenceLabel === "Low" && (
          <p className="detail-low-confidence-note">
            Few stations near your QTH have reported activity on this path recently. This score leans on
            current solar and path conditions rather than live evidence.
          </p>
        )}
      </div>
    </div>
  );
}
