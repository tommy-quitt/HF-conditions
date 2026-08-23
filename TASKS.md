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
- [x] 8. RBN short-burst Telnet adapter (`scripts/adapters/rbn.ts`, ~60-90s
      connect/collect/disconnect per run, configurable via `HF_RBN_COLLECT_MS`).
      Verified live: connected to `telnet.reversebeacon.net:7000`, confirmed the
      plain-text login-prompt + spot-stream protocol, and parsed real spot lines
      (`DX de <skimmer>: <freq>  <call>  <mode>  <SNR> dB  ... <HHMM>Z`). RBN needs
      a real login callsign (`HF_RBN_CALLSIGN`) - collection is skipped, not
      attempted with a fake one, when unset. New piece this step: since RBN gives
      only bare callsigns (no grid/coordinates like PSKReporter/HolyCluster), added
      `scripts/adapters/callsign-location.ts`, a small ITU/IARU callsign-prefix ->
      coarse representative-coordinate table (the deferred real DXCC/CTY dataset
      from step 3 is still deferred; this is a much coarser stand-in scoped to
      what RBN needs). Ran `npm run collect` live with a real 20s RBN burst: 34
      real spots collected and normalized (0 bucketed for the KM72/Israel fixed
      QTH in that sample - expected at this geocoding precision, documented in
      `DEVIATIONS.md`). **Remaining open risk, documented in `DEVIATIONS.md`**:
      only verified from a local network, not from an actual GitHub Actions
      runner - whether Actions' shared IPs are accepted by
      `telnet.reversebeacon.net` is confirmed only once a real scheduled workflow
      run happens (step 10); if blocked, the existing per-source try/catch in
      `collect.ts` already handles it (degraded/disconnected, renormalize) with no
      further code change needed. `typecheck`/`lint`/`test` (123 tests) all clean.
- [x] 9. Trend history and degraded-source UI states (confidence itself already
      landed in step 3/6). Trend (SPEC.md §21) needs "the score 15 minutes ago",
      but scoring runs client-side per viewer QTH (DEVIATIONS.md), so there's no
      server table to hold that history - added `apps/web/src/score-history.ts`,
      a thin, failure-tolerant `localStorage`-backed history scoped per QTH
      (mirrors `qth-storage.ts`'s pattern), layered on top of the still-pure
      `computeConditions`/`trend()` in `packages/core` rather than teaching core
      about browser storage (AGENTS.md). Wired into `App.tsx`: each 5-minute
      refresh looks up the closest-to-15-minutes-ago score before recording the
      new one. Added a trend arrow (↑/↓/→) to `ConditionsMatrix` cells and a
      "Trend: ..." line to `DetailPanel` (`apps/web/src/lib/trend-display.ts`).
      Also extended `DegradedBanner` to flag when the whole `health.json` run
      itself is stale (>30 min old - the collector workflow having stopped
      running, not just one source), addressing SPEC.md §30's "stale NOAA data"
      test case and the general "never silently show stale data as current"
      rule (§26) at the run level, not just per-source. Verified the pure
      history logic (record → lookup within/outside the tolerance window,
      wrong-band/region miss) with an ad hoc `tsx` script against a stubbed
      `localStorage` (no jsdom/Playwright in this pass - consistent with there
      being no unit-test harness for `apps/web` yet, same as step 6).
      `typecheck`/`lint`/`test` (123 tests)/`build` all clean.
- [x] 10. `.github/workflows/ci.yml`: typecheck/lint/test/build on every PR and push
      to `main`. `.github/workflows/collect.yml`: on a `*/15 * * * *` schedule (the
      ~10-15 min interval DEVIATIONS.md already assumed) plus `workflow_dispatch`,
      checks out the `data` branch (bootstrapping it as an empty orphan branch on
      the very first run, since it won't exist yet), seeds `./data` from it so
      `scripts/collect.ts`'s SPEC.md §26 stale-fallback behavior has something to
      fall back to, runs the collector, `npm run sync-data`, builds `apps/web`
      with that data baked into `dist/`, commits the updated JSON back to the
      `data` branch, and deploys `dist/` to GitHub Pages via
      `actions/upload-pages-artifact`/`actions/deploy-pages`. `HF_RBN_CALLSIGN` is
      read from a repo secret (a real callsign, not something to hardcode);
      `HF_HOME_GRID`/`HF_CONTACT_EMAIL` from optional repo variables. Validated
      both files parse as well-formed YAML (`python3 -c "yaml.safe_load(...)"`) -
      **not yet validated with a real workflow run** (needs the repo's Pages
      source set to "GitHub Actions" and, for RBN, the `HF_RBN_CALLSIGN` secret -
      both one-time repo settings outside what a local session can configure; see
      `README.md`'s new Deployment section). That first real run is also this
      project's actual test of TASKS.md step 8's open risk (whether GitHub
      Actions' runner IPs are accepted by `telnet.reversebeacon.net`).
- [x] 11. Tests per SPEC.md §30, docs, finalized `DEVIATIONS.md`. Scoring-side
      §30 scenarios (excellent/weak/no evidence, missing-source renormalization,
      high-Kp event, score clamping at 0/100) already had tests from earlier
      steps; this step filled the remaining gap - `collect.ts`'s own resilience
      path (SPEC.md §26/§30's "stale NOAA data" scenario and a source's failure
      being isolated from the others) had no test at all, because `collect.ts`
      ran `main()` unconditionally at import time. Refactored it to only run
      `main()` when executed directly (`process.argv[1]` vs. `import.meta.url`),
      exported `collectNoaa`/`collectSpotSource`, and added
      `tests/scripts/collect.test.ts` against a temp data directory: NOAA success,
      NOAA failure-with-prior-data (retains the stale value, marks `degraded`,
      never zeroed), NOAA failure-with-no-prior-data (`disconnected`), and the
      same connected/degraded-with-retained-`lastObservationAt` pair for
      `collectSpotSource`. UI-side §30 scenarios (matrix renders, URL grid param,
      QTH changes, detail panel, stale/degraded banner) were verified live via
      Playwright in step 6, plus this step's ad hoc `tsx` check of
      `score-history.ts`'s trend-lookup logic (step 9) - there's still no
      committed browser/component test harness for `apps/web` (no jsdom/
      Playwright dependency retained after those ad hoc checks), which is the
      one honest gap left open here rather than papered over. Docs: `README.md`
      now documents local dev commands, every collector env var, and one-time
      repo setup (Pages source, `HF_RBN_CALLSIGN` secret) the new
      `collect.yml` workflow needs; `DEVIATIONS.md` covers every adaptation made
      through step 10. `typecheck`/`lint`/`test` (128 tests)/`build`/`npm audit`
      all clean.

Full architecture rationale and the two verified feasibility questions (GitHub
Actions/Pages on the free plan; HolyCluster as an HTTP replacement for DX Cluster
Telnet) are in the approved plan. If that plan file isn't available in a future
session, `DEVIATIONS.md` + this file are the durable, in-repo record of the same
decisions.

## Experiments (not yet merged to `main`)

- [x] `experiment/client-side-pskreporter-query`: attempts to close V1's fixed-
      `KM72`-grid PSKReporter limitation (see `DEVIATIONS.md`) by also querying
      PSKReporter directly from the browser for the viewer's own grid, via a real
      JSONP `<script>` tag (`fetch()` doesn't work - the endpoint sends no CORS
      headers, confirmed from a real browser origin, not just assumed from
      Node). Shared the pure query-building/response-normalization logic
      between the Node collector adapter and the new browser client in
      `@hf-conditions/core`'s `external/pskreporter-format.ts` (still no
      network/fs access there - only the transport differs per environment) to
      avoid duplicating it. On success, the viewer's live-queried buckets fully
      replace the fixed-grid ones before scoring; on failure, it falls back to
      the collector's snapshot (never silently shows no PSKReporter evidence),
      and the UI reports which mode is active. **Verified live**: built and
      served `apps/web` for real, drove it with an ad hoc Playwright check (not
      retained as a dependency) against the real `retrieve.pskreporter.info` -
      the JSONP request succeeds from a real browser origin, ~1s round-trip,
      real reception reports returned, matrix scores update accordingly.
      **Open risk, explicitly not claimed as resolved**: only checked from one
      desktop-Chromium/home-network vantage point - whether this holds for
      every real visitor (mobile networks, corporate proxies, blockers) is
      unverified; that's exactly why the fallback path exists. 137 tests (9 new:
      3 for the shared query-builder/JSONP-unwrap logic, 3 for the browser-side
      bucket-merge logic, plus assembling `apps/web/src/**/*.test.ts` into the
      root `vitest.config.ts` for the first time - previously apps/web's pure
      logic, e.g. `score-history.ts`, was only checked ad hoc, per step 9).
      `typecheck`/`lint`/`test`/`build` all clean. Also added `.claude/` to
      `.gitignore` (this session's worktree/job state was showing up as
      untracked) and `.claude/worktrees/**` to `eslint.config.js`'s ignores (a
      concurrent agent's worktree was otherwise getting linted as if it were
      part of this repo). Deliberately deferred: this only touches PSKReporter;
      RBN/DX Cluster remain collector-side only, since they're already global
      firehoses rather than grid-scoped (no fixed-QTH limitation to fix for
      them, per `DEVIATIONS.md`).
