// SPEC.md §3: "Remember the QTH in browser local storage." Kept thin and
// failure-tolerant - localStorage can be unavailable (private browsing,
// disabled storage), and that must never break the app (SPEC.md §27).
const STORAGE_KEY = "hf-conditions:qth-grid";

export function loadStoredGrid(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeGrid(grid: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, grid);
  } catch {
    // No persistence this session; the app still works without it.
  }
}
