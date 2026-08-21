import { BAND_VALUES, REGION_VALUES } from "@hf-conditions/shared";
import type { ConditionCell } from "@hf-conditions/shared";
import { REGION_LABELS } from "../lib/region-labels.js";
import { scoreColor } from "../lib/score-color.js";

// SPEC.md §4: the conditions matrix is the main product. Every cell shows
// its numerical score as text - color is a secondary cue only (§4/§5).
export function ConditionsMatrix({
  cells,
  onSelect,
}: {
  cells: readonly ConditionCell[];
  onSelect: (cell: ConditionCell) => void;
}): React.ReactElement {
  const byKey = new Map(cells.map((cell) => [`${cell.band}|${cell.region}`, cell]));

  return (
    <table className="conditions-matrix">
      <thead>
        <tr>
          <th scope="col">Band</th>
          {REGION_VALUES.map((region) => (
            <th scope="col" key={region}>
              {REGION_LABELS[region]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {BAND_VALUES.map((band) => (
          <tr key={band}>
            <th scope="row">{band}</th>
            {REGION_VALUES.map((region) => {
              const cell = byKey.get(`${band}|${region}`);
              if (!cell) return <td key={region} />;
              return (
                <td key={region}>
                  <button
                    type="button"
                    className="score-cell"
                    style={{ borderColor: scoreColor(cell.label) }}
                    onClick={() => onSelect(cell)}
                    aria-label={`${band} to ${REGION_LABELS[region]}: ${cell.score}, ${cell.label}, ${cell.confidenceLabel} confidence`}
                  >
                    <span className="score-value">{cell.score}</span>
                    <span className="score-label">{cell.label}</span>
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
