import path from "node:path";

// SPEC.md §24/DEVIATIONS.md: the committed JSON store replaces PostgreSQL.
// Defaults to a `data/` directory relative to the caller's working
// directory so scripts/collect.ts and local tooling agree without this
// package hardcoding an absolute repo path.
export const DEFAULT_DATA_DIR = "data";

export function resolveDataPath(fileName: string, dataDir: string = DEFAULT_DATA_DIR): string {
  return path.join(dataDir, fileName);
}
