# Build sequence

Tracks progress against the approved plan (GitHub-only architecture: GitHub Pages +
GitHub Actions, no dedicated server — see `DEVIATIONS.md` for why and how). Check items
off as they land; keep this file in sync with reality rather than the plan doc.

- [x] 1. Repo scaffolding: npm-workspaces monorepo (`apps/`, `packages/{shared,core,data-io}`,
      `scripts/`, `.github/workflows/`, `tests/`), root `tsconfig`/`package.json`,
      `AGENTS.md`, `SPEC.md`, `DEVIATIONS.md`, `README.md`. Verified: `npm install`,
      `npm run typecheck`, `npm audit` all clean.
- [x] 2. `packages/shared`: Zod schemas for spot, aggregate, solar, conditions matrix, health.
      Also added band/region/operating-mode/grid/QTH schemas these depend on, an
      `eslint.config.js` (missing since step 1), and `tests/tsconfig.json` +
      `vitest.config.ts` so tests type-check without vitest double-running
      tsc's emitted `dist/tests` output. Verified: `npm run typecheck`,
      `npm run lint`, `npm test` (18 tests), `npm audit` all clean.
- [x] 3. `packages/core`: Maidenhead conversion (4/6/8-char, both directions), great-circle
      distance, band classification, `RegionResolver` interface with a coordinate-based
      implementation and a DXCC-entity-table-based implementation (composed so coordinates
      are preferred, per SPEC.md §10), recency/locality/direction weighting, evidence
      formulas, solar/path modifiers (path modifier uses a standard NOAA solar-position
      approximation), confidence, trend, score/confidence labels. Pure, deterministic, no
      network/db access - verified it runs from both `packages/core`'s own build and the
      test suite. 66 unit tests across Maidenhead/band/geography/distance/recency/
      locality/scoring per SPEC.md §30. Verified: `npm run typecheck`, `npm run lint`,
      `npm test`, `npm audit` all clean.
      **Deliberately deferred**: the real DXCC/CTY dataset (content + license
      verification, per SPEC.md §10's redistributability requirement) is not sourced yet.
      `createDxccRegionResolver` takes the entity->continent table as a plain injected
      argument rather than hardcoding one, so this doesn't block scoring-engine work; the
      actual dataset gets sourced and its license verified live when the collector needs
      it (step 4+), consistent with verifying external claims before locking them in.
- [x] 4. `scripts/collect.ts` + NOAA adapter (HTTP GET). Proves the pipeline end-to-end:
      fetch (verified live against `services.swpc.noaa.gov`'s Kp-index and F10.7-flux
      JSON feeds) → normalize/validate via `packages/shared`'s `SolarObservationSchema`
      → write `data/solar.json` and an upserted `data/health.json` entry via new
      `packages/data-io` helpers (`json-store`, `health-store`, `solar-store`). No
      aggregation step yet - NOAA is a single current reading, not a spot stream;
      aggregation lands with the PSKReporter/RBN/DX Cluster adapters (steps 5/7/8).
      "Commit" is deliberately NOT done inside `collect.ts` - it only writes local JSON,
      identically whether run locally or in CI; committing/pushing to the `data` branch
      is the GitHub Actions workflow's job (step 10), keeping the script itself
      environment-agnostic. On fetch failure the last known `solar.json` is left
      untouched and `health.json` is marked `degraded`/`disconnected` (SPEC.md §26) -
      never silently zeroed. Verified: ran `npm run collect` against live NOAA and
      inspected the resulting `data/solar.json`/`data/health.json` (both gitignored -
      DEVIATIONS.md's `data` branch is where this is meant to persist for real).
      `typecheck`/`lint`/`test` (75 tests)/`audit` all clean.
- [x] 5. PSKReporter HTTP-polling adapter (deviation from MQTT — see `DEVIATIONS.md`) plus
      a real evidence pipeline in `packages/core` (`resolveSpotLocality`, `bucketSpots`,
      `summarizeRecentAggregates`) and a `packages/data-io` `aggregate-store` for the
      rolling 5-minute-bucket history. Verified live against
      `retrieve.pskreporter.info`'s grid-scoped query (`callsign=<grid>&modify=grid`,
      including its documented `callback=` JSONP parameter for clean JSON). **New
      deviation, documented in `DEVIATIONS.md`**: PSKReporter's query API is
      grid/callsign-scoped, not a global firehose, so V1 collects for one fixed home
      grid (`KM72`, overridable via `HF_HOME_GRID`) rather than an arbitrary per-viewer
      QTH — surfaced to the user as a real architectural fork (dynamic per-viewer
      client-side JSONP vs. fixed collector-side grid vs. a hybrid) and resolved in favor
      of the fixed grid for the first version. Ran `npm run collect` against live NOAA +
      PSKReporter end-to-end: 675 raw spots normalized down to 31 five-minute aggregate
      buckets across EUROPE/ASIA (no NORTH_AMERICA activity on air from KM72 at the time
      of the run — expected, not a bug). `typecheck`/`lint`/`test` (93 tests)/`audit` all
      clean.
- [x] 6. `apps/web` skeleton (Vite + React + TypeScript, per the plan's framework choice):
      QTH input (URL param, overriding `localStorage`, overriding a first-visit prompt
      with a grid field and "use my current location") → `packages/core`'s new
      `computeConditions` orchestrator (added this step - ties evidence/observed-
      score/solar-modifier/path-modifier/confidence/final-score together into one
      `ConditionCell` per band/region, the client-side replacement for `GET
      /api/conditions`) → a 10-band × 3-region matrix, a click-through detail panel
      showing every component score, and a degraded-source banner driven by
      `health.json`. Live refresh every 5 minutes (SPEC.md §25). Also added
      `packages/core`'s `greatCircleMidpoint` (path modifier's third point) and
      `resolveQthInput` (shared grid/lat-lon parsing for both the URL-param and
      text-input paths). `npm run sync-data` copies collector output into
      `apps/web/public/data` for local dev. Verified for real: built the app, served it
      with `vite preview`, and drove it with a Playwright script (installed
      ad hoc for this check) against the real data collected in step 5 - confirmed the
      QTH prompt, the matrix (real scores, e.g. upper HF bands showing Good/Excellent
      on a real August midday, lower bands showing Poor from the daylight path
      penalty), the detail panel's component breakdown, and panel close all work with
      zero console errors. Noticed and kept as correct, not a bug: a band with one
      weak/stale real spot can score *lower* than a band with zero evidence, because
      real bad evidence overrides the no-data optimistic baseline - documented for
      the record here since it looks surprising at a glance. `typecheck` (including
      the new `npm run typecheck --workspaces` wiring)/`lint`/`test` (108 tests)/`build`
      all clean.
- [x] 7. HolyCluster HTTP adapter for DX Cluster evidence. Re-verified live (params
      changed since the original plan doc): `?start_time=&end_time=` take UNIX
      seconds, not ISO timestamps (an ISO string 422s) - returns `{"spots": [...]}`
      with per-spot `[lon, lat]` coordinates and DXCC codes already resolved. Confirmed
      the feed is a genuine global firehose (not scoped like PSKReporter) blending
      classic manual DX-cluster spots with POTA/WWFF/SOTA activator spots (via a
      `type` field) - all folded into one `dxCluster` evidence source for V1
      (SPEC.md §7.4's "human cluster spots" characterization covers all of them).
      Also refactored `collect.ts`'s PSKReporter/DX-Cluster paths into one shared
      `collectSpotSource` helper (fetch → bucket → append → health), ready for RBN to
      reuse in step 8. Ran `npm run collect` live: NOAA + 581 PSKReporter spots (34
      buckets) + 268 HolyCluster spots (4 buckets, since Israel-area DX-cluster/POTA
      activity was sparser than PSKReporter's automated FT8 traffic at collection
      time - expected, not a bug). `typecheck`/`lint`/`test` (113 tests)/`build` all
      clean.
- [ ] 8. RBN short-burst Telnet adapter (~60-90s connect/collect/disconnect per run).
      **Open risk to validate here**: does `telnet.reversebeacon.net` accept
      connections from GitHub Actions' shared runner IPs? If not, omit RBN and
      renormalize per SPEC.md §15, document in `DEVIATIONS.md`.
- [ ] 9. Confidence, trend history, degraded-source UI states.
- [ ] 10. `.github/workflows/collect.yml` (schedule + `workflow_dispatch` + Pages deploy)
      and `ci.yml` (lint/typecheck/test on PRs).
- [ ] 11. Tests per SPEC.md §30 across all of the above; docs; finalize `DEVIATIONS.md`.

Full architecture rationale and the two verified feasibility questions (GitHub
Actions/Pages on the free plan; HolyCluster as an HTTP replacement for DX Cluster
Telnet) are in the approved plan. If that plan file isn't available in a future
session, `DEVIATIONS.md` + this file are the durable, in-repo record of the same
decisions.
