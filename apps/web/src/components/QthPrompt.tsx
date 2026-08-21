import { useState } from "react";
import { resolveQthInput } from "@hf-conditions/core";
import type { Qth } from "@hf-conditions/shared";

// SPEC.md §3 first-visit UX: a grid text input plus "Use this QTH" and "Use
// my current location".
export function QthPrompt({ onResolve }: { onResolve: (qth: Qth) => void }): React.ReactElement {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function submitGrid(): void {
    const qth = resolveQthInput({ grid: value });
    if (!qth) {
      setError("Enter a valid Maidenhead locator, e.g. KM72.");
      return;
    }
    setError(null);
    onResolve(qth);
  }

  function useCurrentLocation(): void {
    if (!navigator.geolocation) {
      setError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const qth = resolveQthInput({
          lat: String(position.coords.latitude),
          lon: String(position.coords.longitude),
        });
        if (qth) {
          onResolve(qth);
        } else {
          setError("Could not resolve your current location.");
        }
      },
      () => {
        setLocating(false);
        setError("Location permission was denied.");
      },
    );
  }

  return (
    <div className="qth-prompt">
      <h1>HF Conditions</h1>
      <label htmlFor="qth-grid-input">Your QTH</label>
      <input
        id="qth-grid-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submitGrid();
        }}
        placeholder="KM72"
        autoFocus
      />
      <div className="qth-prompt-actions">
        <button type="button" onClick={submitGrid}>
          Use this QTH
        </button>
        <button type="button" onClick={useCurrentLocation} disabled={locating}>
          {locating ? "Locating…" : "Use my current location"}
        </button>
      </div>
      {error && <p className="qth-prompt-error">{error}</p>}
    </div>
  );
}
