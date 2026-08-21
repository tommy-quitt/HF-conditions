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

See `TASKS.md` for progress against the build sequence and `DEVIATIONS.md` for
what's adapted from `SPEC.md` and why.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build --workspaces --if-present
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

Collector configuration (all optional except `HF_RBN_CALLSIGN`, without which RBN
collection is skipped rather than attempted with a fake login):

| Variable | Purpose | Default |
|---|---|---|
| `HF_HOME_GRID` | Fixed home grid PSKReporter/HolyCluster/RBN evidence is collected for (DEVIATIONS.md's V1 fixed-QTH simplification) | `KM72` |
| `HF_CONTACT_EMAIL` | Sent as PSKReporter's `appcontact` query param | unset |
| `HF_RBN_CALLSIGN` | Real callsign RBN's Telnet server requires at login | unset (RBN skipped) |
| `HF_RBN_HOST` / `HF_RBN_PORT` | Override the RBN Telnet endpoint | `telnet.reversebeacon.net` / `7000` |
| `HF_RBN_COLLECT_MS` | How long to stay connected per run | `75000` |
| `HF_DATA_DIR` | Where the collector reads/writes its JSON store | `data` |

## Deployment (`.github/workflows/collect.yml`)

On a schedule (and via manual `workflow_dispatch`), a GitHub Actions workflow runs
the collector, builds `apps/web` with the fresh data baked in, commits the updated
JSON to a dedicated `data` branch (DEVIATIONS.md), and deploys the built site to
GitHub Pages. One-time repo setup this depends on:

- **Pages source**: repo Settings → Pages → Build and deployment → Source →
  "GitHub Actions".
- **`HF_RBN_CALLSIGN` secret** (Settings → Secrets and variables → Actions →
  Secrets): a real amateur radio callsign for the RBN Telnet login. Without it,
  scheduled runs skip RBN and the other sources are renormalized (SPEC.md §15) -
  the site still works, just without that source's evidence.
- Optionally, `HF_HOME_GRID` / `HF_CONTACT_EMAIL` repository variables (Settings →
  Secrets and variables → Actions → Variables) to override the defaults above.
