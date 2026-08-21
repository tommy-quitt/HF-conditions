import type { SolarObservation } from "@hf-conditions/shared";
import { SolarObservationSchema } from "@hf-conditions/shared";
import { readJsonFile, writeJsonFile } from "./json-store.js";

// SPEC.md §24 solar_observations, adapted to a single committed JSON file
// (DEVIATIONS.md) holding the latest observation - V1 only needs the
// current solar summary (§4/§22), not a retained history.
export async function readLatestSolarObservation(filePath: string): Promise<SolarObservation | null> {
  return readJsonFile(filePath, SolarObservationSchema);
}

export async function writeLatestSolarObservation(
  filePath: string,
  observation: SolarObservation,
): Promise<void> {
  await writeJsonFile(filePath, observation, SolarObservationSchema);
}
