# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A website that answers: from my location, which HF bands are open right now toward
Europe, North America and Asia? It combines observed propagation (PSKReporter, RBN, DX
cluster activity), solar/geomagnetic conditions, and the geographic relationship between
the viewer's QTH and each destination into an explainable 0-100 score per band/region —
never just generic solar indices.

Read these before making non-trivial changes, in this order:

1. `SPEC.md` — the authoritative product/technical spec.
2. `DEVIATIONS.md` — every deliberate place the implementation departs from `SPEC.md`
   (all forced by the GitHub-only hosting constraint) and why.
3. `TASKS.md` — build sequence and what's actually landed vs. still open.
4. `AGENTS.md` — hard rules for working in this codebase (see below; read the file
   itself, this is not a full restatement).

## Architecture

Runs entirely on GitHub, no dedicated server:

- **GitHub Actions** (`.github/workflows/collect.yml`), on a 15-minute schedule, runs
  `scripts/collect.ts`: polls NOAA, PSKReporter, and HolyCluster (RBN only if
  `HF_RBN_CALLSIGN` is configured), normalizes results, and writes JSON. That JSON is
  committed to a dedicated **`data` branch** (not `main` — see DEVIATIONS.md), and the
  same workflow run builds `apps/web` with that data baked in and deploys it to GitHub
  Pages.
- **GitHub Pages** serves the static site. The conditions matrix (score per band ×
  region) is computed **in the browser** from the fetched JSON — there is no
  `GET /api/conditions` endpoint; `apps/web/src/App.tsx` calls
  `computeConditions` (from `packages/core`) directly on evidence fetched via
  `fetch-evidence.ts`.
- **Experimental branch feature** (see `apps/web/src/live-pskreporter-evidence.ts` and
  DEVIATIONS.md): rather than relying solely on the collector's fixed-home-grid
  PSKReporter snapshot, the browser also queries PSKReporter live for the viewer's own
  grid and merges those buckets in, falling back to the collector snapshot if the live
  query fails.

### Workspace layout (npm workspaces monorepo)

- `packages/shared` (`@hf-conditions/shared`) — Zod schemas + inferred types for every
  cross-boundary contract (spot, aggregate, solar, conditions, health, qth, band,
  region...). This is the validation boundary between untrusted external data and
  everything else.
- `packages/core` (`@hf-conditions/core`) — **all scoring logic**: Maidenhead
  conversion, great-circle distance/midpoint, band/region classification, recency/
  locality/direction weighting, evidence formulas, solar/path modifiers, confidence,
  trend, and the `computeConditions`/`computeConditionCell` orchestrator. Must stay
  pure and deterministic — **no network or filesystem access**, ever — because it runs
  unchanged in both the Node collector and the browser bundle.
- `packages/data-io` (`@hf-conditions/data-io`) — read/write/prune helpers for the
  committed JSON data store (`solar.json`, `aggregates.json`, `health.json`), replacing
  what would otherwise be a database.
- `scripts/collect.ts` + `scripts/adapters/*` — the collector entry point and one
  adapter per external system (NOAA, PSKReporter, RBN, HolyCluster, callsign-location).
  Each source is fetched/collected through its own try/catch in `collect.ts`
  (`collectSpotSource` / `collectNoaa`): one source failing must never affect another,
  and must never be silently treated as connected/fresh — it's reported as
  degraded/disconnected in `health.json` instead, and downstream scoring renormalizes
  remaining weights (SPEC.md §15/§19/§26).
- `apps/web` (`@hf-conditions/web`) — the React + Vite site. Fetches evidence JSON,
  runs it through `packages/core`, renders the matrix.
- `scripts/sync-data.ts` — local-dev-only convenience: copies `./data` (the collector's
  local output dir) into `apps/web/public/data` so `vite dev` can serve it.
- `tests/` — all test files live here (not colocated with source), mirroring the
  workspace structure: `tests/core`, `tests/data-io`, `tests/scripts`, `tests/shared`.
  (Exception: `apps/web/src/live-pskreporter-evidence.test.ts` is colocated.)

### Data flow

`collect.ts` → adapters fetch + normalize → `bucketSpots` (packages/core) aggregates
spots into 5-minute buckets by band/region/source → `data-io` appends to
`aggregates.json` / upserts `health.json` / writes `solar.json` → workflow commits
those three files to the `data` branch and deploys the site → browser fetches them via
`fetch-evidence.ts` → `computeConditions` (packages/core) turns buckets + solar into a
`ConditionCell` per band/region → React renders it.

## Commands

```bash
npm install
npm run typecheck        # tsc --build --force across the whole repo, then per-workspace
npm run lint              # eslint .
npm test                  # vitest run (all tests: tests/** plus colocated apps/web tests)
npm run build --workspaces --if-present
```

Run a single test file or pattern directly with vitest, e.g.:

```bash
npx vitest run tests/core/scoring.test.ts
npx vitest run -t "some test name"
```

Run the collector locally (writes to `./data`, gitignored):

```bash
npm run collect
```

Then copy that output into the web app and run it:

```bash
npm run sync-data
npm run dev --workspace apps/web
```

Collector configuration is via environment variables (all optional except
`HF_RBN_CALLSIGN`, without which RBN collection is skipped rather than attempted with a
fake login) — see the table in `README.md` for the full list
(`HF_HOME_GRID`, `HF_CONTACT_EMAIL`, `HF_RBN_CALLSIGN`, `HF_RBN_HOST`/`HF_RBN_PORT`,
`HF_RBN_COLLECT_MS`, `HF_DATA_DIR`).

CI (`.github/workflows/ci.yml`) runs typecheck → lint → test → build on every PR and
push to `main`; match that sequence locally before considering work done.

## Rules specific to this repo (see `AGENTS.md` for the authoritative version)

- `SPEC.md` is authoritative; don't silently change product requirements or scoring
  formulas beyond what `DEVIATIONS.md` already documents. If a real external source
  behaves differently than the spec assumed, isolate the discrepancy behind its adapter,
  document it in `DEVIATIONS.md`, and implement the safest fallback — don't work around
  it ad hoc.
- `packages/core` stays deterministic, network/filesystem-free. External systems are
  only ever accessed through collector adapters, never inlined into scoring or UI code.
- Never fabricate a value for an unavailable data source; missing data is represented as
  missing (confidence/UI react accordingly), never defaulted to 0 or a plausible-looking
  placeholder.
- TypeScript strict mode everywhere. `any` only at untrusted external boundaries (raw
  API/Telnet responses), and that data must be validated against `packages/shared`'s Zod
  schemas before crossing into `packages/core`.
- Business logic changes require tests. Never commit secrets; data-source
  hostnames/ports are configuration, not hardcoded.
- No score or explanation is ever LLM-generated (SPEC.md §6, §36) — explanations are
  rule/template-generated from stored component scores.
