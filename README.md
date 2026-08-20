# HF Conditions

A website that answers: from my location, which HF bands are open right now toward
Europe, North America and Asia? It combines observed propagation (PSKReporter, RBN,
DX cluster activity), solar/geomagnetic conditions, and the geographic relationship
between your QTH and each destination into an explainable 0-100 score per band and
region — never just generic solar indices.

Full product and technical requirements: [`SPEC.md`](./SPEC.md).

## Architecture

This runs entirely on GitHub — no dedicated server:

- **GitHub Pages** serves a static site. The final conditions matrix is computed
  **in the browser**, using your QTH, from a small evidence dataset fetched as JSON.
- **GitHub Actions**, on a schedule, runs the collector (`scripts/collect.ts`), which
  polls NOAA, PSKReporter, RBN and a DX cluster aggregator, normalizes and aggregates
  what it finds, and commits the result as JSON for the site to consume.

The written spec assumes a persistent server + database + always-open MQTT/Telnet
connections. Running without a dedicated server required deliberate adaptations to
that design — every one of them is recorded, with rationale, in
[`DEVIATIONS.md`](./DEVIATIONS.md).

Rules for anyone (human or agent) working on this codebase are in
[`AGENTS.md`](./AGENTS.md).

## Status

Early scaffolding. See `DEVIATIONS.md` and the project history for current progress
against the build sequence.

## Development

```bash
npm install
npm run typecheck
npm test
```

(Running the collector and the site locally will be documented here once they exist.)
