import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";

// Generic read/write for one committed JSON file, validated against its Zod
// schema at both boundaries (AGENTS.md: validate data crossing into
// packages/core; never let a malformed file on disk silently pass through).
export async function readJsonFile<Schema extends z.ZodTypeAny>(
  filePath: string,
  schema: Schema,
): Promise<z.infer<Schema> | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return schema.parse(JSON.parse(raw));
}

export async function writeJsonFile<Schema extends z.ZodTypeAny>(
  filePath: string,
  value: z.infer<Schema>,
  schema: Schema,
): Promise<void> {
  const validated = schema.parse(value);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}
