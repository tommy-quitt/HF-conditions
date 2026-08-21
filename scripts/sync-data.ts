import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

// Local-dev convenience only: copies the collector's output into apps/web's
// public/ dir so `npm run dev --workspace apps/web` can serve it at
// /data/*.json - matching how the built site and its data get published
// together in production (DEVIATIONS.md's `data` branch).
const SOURCE_DIR = process.env.HF_DATA_DIR ?? "data";
const TARGET_DIR = path.join("apps", "web", "public", "data");

async function main(): Promise<void> {
  await mkdir(TARGET_DIR, { recursive: true });
  await cp(SOURCE_DIR, TARGET_DIR, { recursive: true });
  console.log(`Copied ${SOURCE_DIR} -> ${TARGET_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
