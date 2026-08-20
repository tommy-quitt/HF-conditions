# Build sequence

Tracks progress against the approved plan (GitHub-only architecture: GitHub Pages +
GitHub Actions, no dedicated server — see `DEVIATIONS.md` for why and how). Check items
off as they land; keep this file in sync with reality rather than the plan doc.

- [x] 1. Repo scaffolding: npm-workspaces monorepo (`apps/`, `packages/{shared,core,data-io}`,
      `scripts/`, `.github/workflows/`, `tests/`), root `tsconfig`/`package.json`,
      `AGENTS.md`, `SPEC.md`, `DEVIATIONS.md`, `README.md`. Verified: `npm install`,
      `npm run typecheck`, `npm audit` all clean.
- [ ] 2. `packages/shared`: Zod schemas for spot, aggregate, solar, conditions matrix, health.
- [ ] 3. `packages/core`: Maidenhead conversion, great-circle distance, band classification,
      `RegionResolver` interface + DXCC/CTY-based implementation, recency/locality/direction
      weighting, evidence formulas, solar/path modifiers, confidence, trend. Pure,
      deterministic, no network/db access (must run in Node and browser alike). Unit
      tests with fixed fixtures (SPEC.md §30).
- [ ] 4. `scripts/collect.ts` + NOAA adapter (HTTP GET). Proves the pipeline end-to-end:
      fetch → normalize → aggregate → write JSON → commit.
- [ ] 5. PSKReporter HTTP-polling adapter (deviation from MQTT — see `DEVIATIONS.md`).
- [ ] 6. `apps/web` skeleton: QTH input (URL param / localStorage), fetch static JSON,
      render matrix using `packages/core` in the browser.
- [ ] 7. HolyCluster HTTP adapter for DX Cluster evidence
      (`holycluster.iarc.org/history?start_time=&end_time=` — already verified live).
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
