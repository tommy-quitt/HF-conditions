import type { DataSourceHealth, DataSourceName, HealthResponse } from "@hf-conditions/shared";
import { HealthResponseSchema } from "@hf-conditions/shared";
import { readJsonFile, writeJsonFile } from "./json-store.js";

// SPEC.md §31/§26: one entry per data source. Upserted independently so
// updating one source's health never clobbers another's - each external
// adapter's failure is isolated (AGENTS.md).
export async function upsertDataSourceHealth(
  filePath: string,
  entry: DataSourceHealth,
  generatedAt: string,
): Promise<HealthResponse> {
  const existing = await readJsonFile(filePath, HealthResponseSchema);
  const sources = (existing?.sources ?? []).filter((source) => source.source !== entry.source);
  sources.push(entry);

  const health: HealthResponse = { generatedAt, sources };
  await writeJsonFile(filePath, health, HealthResponseSchema);
  return health;
}

export async function readDataSourceHealth(
  filePath: string,
  source: DataSourceName,
): Promise<DataSourceHealth | null> {
  const existing = await readJsonFile(filePath, HealthResponseSchema);
  return existing?.sources.find((entry) => entry.source === source) ?? null;
}
