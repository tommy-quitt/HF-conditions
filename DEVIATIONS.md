# Deviations from SPEC.md

`SPEC.md` assumes a persistent server topology: a Next.js server, PostgreSQL, and a
long-running collector process holding open an MQTT connection (PSKReporter) and two
Telnet connections (RBN, DX Cluster) continuously (SPEC.md §7.2-7.4, §23, §33).

This project runs entirely on GitHub Pages (static hosting) + GitHub Actions (scheduled
jobs) — no dedicated server. GitHub Pages cannot run server code, and GitHub Actions
jobs are short-lived, so nothing can hold a persistent connection open. Per SPEC.md
§37 ("preserve the intended product behavior, isolate the discrepancy behind an
adapter, document the issue, implement the safest practical fallback"), each
persistent-connection requirement is adapted as follows. Everything else in SPEC.md
(scoring formulas, weights, confidence, no-LLM rule, region resolver interface, testing
requirements, UI principles) is implemented as written.

| Spec assumption | Adapted to | Why |
|---|---|---|
| Persistent MQTT feed (PSKReporter, §7.2) | Scheduled HTTP GET against PSKReporter's query/retrieval endpoint every ~10-15 min | No persistent connections are possible in a scheduled Actions job. A 10-15 min poll is not the "aggressive polling" the spec cautions against with that same endpoint. |
| Persistent Telnet feed (RBN, §7.3) | Short (~60-90s) connect-collect-disconnect burst each scheduled run | RBN has no live HTTP alternative (only previous-day zip archives at reversebeacon.net/raw_data/). This samples the stream rather than continuously monitoring it — spots arriving between runs are lost. Open risk: unconfirmed whether GitHub Actions' shared runner IPs are accepted by `telnet.reversebeacon.net`. If not, RBN evidence is omitted and the remaining sources are renormalized per §15, with reduced confidence per §19/§26. |
| Persistent Telnet connection to a DX Cluster node (§7.4) | Scheduled HTTPS GET against `holycluster.iarc.org/history?start_time=&end_time=` | Verified live: an unauthenticated public JSON endpoint that already aggregates several standard DX-Spider/AR-Cluster/CC-Cluster nodes (see its own `telnet_servers.csv`) and returns pre-resolved coordinates/continent per spot. Caveat: third-party, undocumented, unlicensed, no stated SLA. A raw multi-node Telnet-burst adapter (same pattern as RBN) is the documented fallback if this service becomes unavailable. |
| PostgreSQL (§23, §24) | Committed JSON files in a dedicated `data` branch, pruned each run | Matches V1's own modest retention needs (~60-120 min raw, small aggregates); avoids running a database with nothing to host it on. |
| Next.js server + `GET /api/conditions` (§22, §23) | Static JSON evidence feed + the same `packages/core` scoring engine run client-side in the browser | Per-viewer QTH determines locality/direction weighting, so the final matrix can't be precomputed once for every grid square. Shipping the evidence and running the (already pure, deterministic, network-free) scoring engine in the browser reproduces the same typed contract without a live server. |
| Live `GET /api/health` (§31) | Static `health.json` written each collection run | Reports "as of the last scheduled run" rather than an instantaneous socket status — call this out in the UI copy rather than implying a live probe. |
| Continuous `apps/collector` daemon (§23, §33) | `scripts/collect.ts`, invoked by a GitHub Actions scheduled workflow | Same normalization/aggregation responsibilities, just re-triggered per run instead of running forever. |
