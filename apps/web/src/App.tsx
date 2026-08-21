import { useCallback, useEffect, useMemo, useState } from "react";
import { computeConditions, resolveQthInput } from "@hf-conditions/core";
import type { ConditionCell, Qth } from "@hf-conditions/shared";
import { ConditionsMatrix } from "./components/ConditionsMatrix.js";
import { DegradedBanner } from "./components/DegradedBanner.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { QthPrompt } from "./components/QthPrompt.js";
import { fetchEvidence, type Evidence } from "./fetch-evidence.js";
import { loadStoredGrid, storeGrid } from "./qth-storage.js";

// SPEC.md §25: "Live page refresh: every five minutes."
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// SPEC.md §3: "URL parameters override local storage."
function resolveInitialQth(): Qth | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = resolveQthInput({ grid: params.get("grid"), lat: params.get("lat"), lon: params.get("lon") });
  if (fromUrl) return fromUrl;

  const storedGrid = loadStoredGrid();
  return storedGrid ? resolveQthInput({ grid: storedGrid }) : null;
}

export function App(): React.ReactElement {
  const [qth, setQth] = useState<Qth | null>(() => resolveInitialQth());
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<ConditionCell | null>(null);
  const [now, setNow] = useState(() => new Date());

  const handleQthResolved = useCallback((resolved: Qth) => {
    setQth(resolved);
    if (resolved.grid) storeGrid(resolved.grid);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await fetchEvidence();
        if (!cancelled) {
          setEvidence(data);
          setFetchError(null);
          setNow(new Date());
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const conditions = useMemo(() => {
    if (!qth || !evidence) return null;
    return computeConditions({ qth, solar: evidence.solar, buckets: evidence.buckets, now });
  }, [qth, evidence, now]);

  if (!qth) {
    return <QthPrompt onResolve={handleQthResolved} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>HF Conditions</h1>
        <p className="app-subheader">
          QTH: {qth.grid ?? `${qth.lat.toFixed(1)}, ${qth.lon.toFixed(1)}`}
          {" · "}
          Updated: {now.toLocaleTimeString()}
          {evidence && (
            <>
              {" · "}
              Solar Flux: {evidence.solar.f107} | Kp: {evidence.solar.kp}
            </>
          )}
        </p>
      </header>

      <DegradedBanner health={evidence?.health ?? null} />
      {fetchError && <p className="fetch-error">Couldn't refresh conditions: {fetchError}</p>}

      {conditions ? (
        <ConditionsMatrix cells={conditions.conditions} onSelect={setSelectedCell} />
      ) : (
        <p>Loading conditions…</p>
      )}

      {selectedCell && <DetailPanel cell={selectedCell} onClose={() => setSelectedCell(null)} />}
    </div>
  );
}
