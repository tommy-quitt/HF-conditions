import type { HealthResponse, SolarObservation, SpotAggregateBucket } from "@hf-conditions/shared";
import { HealthResponseSchema, SolarObservationSchema, SpotAggregateBucketSchema } from "@hf-conditions/shared";
import { z } from "zod";

// SPEC.md §22-24, adapted per DEVIATIONS.md: this replaces `GET
// /api/conditions`/`GET /api/health` with static JSON fetched from the same
// origin as the site (published together by the collector workflow).
export interface Evidence {
  solar: SolarObservation;
  buckets: SpotAggregateBucket[];
  health: HealthResponse;
}

const SpotAggregateBucketArraySchema = z.array(SpotAggregateBucketSchema);

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return schema.parse(await response.json());
}

export async function fetchEvidence(dataBaseUrl = "./data"): Promise<Evidence> {
  const [solar, buckets, health] = await Promise.all([
    fetchJson(`${dataBaseUrl}/solar.json`, SolarObservationSchema),
    fetchJson(`${dataBaseUrl}/aggregates.json`, SpotAggregateBucketArraySchema),
    fetchJson(`${dataBaseUrl}/health.json`, HealthResponseSchema),
  ]);
  return { solar, buckets, health };
}
