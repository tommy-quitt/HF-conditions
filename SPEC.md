# HF Conditions
## V1 Product and Technical Specification

### 1. Product goal

Build a web application that answers one question:

> **From my location, which HF bands are open right now toward Europe, North America and Asia?**

The application must not simply display generic solar conditions. It must combine:

1. actual observed propagation,
2. solar and geomagnetic conditions,
3. actual amateur-radio cluster activity,
4. geographical relationship between the user's QTH and destination,
5. freshness and quantity of observations.

The primary output is a simple matrix:

| Band | Europe | North America | Asia |
|---|---:|---:|---:|
| 160m | 18 | 4 | 12 |
| 80m | 27 | 10 | 24 |
| 60m | 35 | 18 | 31 |
| 40m | 61 | 34 | 66 |
| 30m | 76 | 58 | 79 |
| 20m | 91 | 78 | 87 |
| 17m | 86 | 72 | 89 |
| 15m | 79 | 61 | 92 |
| 12m | 58 | 39 | 71 |
| 10m | 42 | 23 | 57 |

Every score must be explainable.

The product must never imply scientific precision that the data does not support.

---

# 2. V1 scope

V1 is a **live HF conditions engine**, not a long-term propagation forecast.

It answers:

> What appears to be open now?

V1 does not attempt to answer:

> What will be open at 22:00 tonight?

Forecasting using VOACAP, ITURHFProp or another propagation model is reserved for a later release.

### Supported bands

- 160m
- 80m
- 60m
- 40m
- 30m
- 20m
- 17m
- 15m
- 12m
- 10m

### Supported destinations

- Europe
- North America
- Asia

Architecture must allow adding later:

- Africa
- South America
- Oceania
- specific country
- specific Maidenhead locator
- specific callsign

### Operating mode

V1 displays **General HF Conditions**.

The architecture must include a `mode` property internally so V2 can calculate separate:

- General
- Digital
- CW
- SSB

Do not implement the separate mode UI in V1.

---

# 3. QTH input

The application must support location as a URL parameter.

Preferred:

`?grid=KM72`

Also support:

`?lat=32.1&lon=34.8`

Support Maidenhead locators with:

- 4 characters
- 6 characters
- 8 characters where practical

Example:

`/?grid=KM72`

The application must convert Maidenhead locator to latitude/longitude internally.

### User experience

On first visit:

**Your QTH**

Input:
`KM72`

Buttons:

**Use this QTH**

**Use my current location**

If the user chooses browser geolocation, convert coordinates into a Maidenhead locator for display.

Remember the QTH in browser local storage.

No account is required.

URL parameters override local storage.

---

# 4. Primary screen

The main page should be optimized for something a radio amateur can leave open beside the transceiver.

Header:

**HF Conditions**

Secondary information:

`QTH: KM72`

`Updated: 12:14:32 local`

`Solar Flux: 132 | Kp: 2.3`

Then display the conditions matrix.

Example:

| Band | Europe | N. America | Asia |
|---|---|---|---|
| 160m | 🔴 12 | 🔴 3 | 🔴 9 |
| 80m | 🔴 26 | 🔴 8 | 🔴 22 |
| 40m | 🟢 67 | 🟠 39 | 🟢 63 |
| 30m | 🟢 76 | 🟡 55 | 🟢 79 |
| 20m | 🟢 **91** | 🟢 **78** | 🟢 **87** |
| 17m | 🟢 **86** | 🟢 **72** | 🟢 **89** |
| 15m | 🟢 79 | 🟡 61 | 🟢 **92** |
| 12m | 🟡 58 | 🟠 39 | 🟢 71 |
| 10m | 🟠 42 | 🔴 23 | 🟡 57 |

Do not rely on color alone. Every cell contains a numerical score.

---

# 5. Score interpretation

Scores are integers from 0 through 100.

| Score | Label |
|---:|---|
| 0-19 | Very Poor |
| 20-39 | Poor |
| 40-59 | Fair |
| 60-79 | Good |
| 80-100 | Excellent |

Avoid the word **Closed** because absence of observed activity does not prove that a path is physically closed.

---

# 6. Cell details

Clicking any matrix cell opens a details panel.

Example:

## 20m → Europe

**91 - Excellent**

**Confidence: High**

### Live evidence

PSKReporter  
`128 weighted reports`

RBN  
`37 weighted reports`

DX Cluster  
`12 relevant spots`

### Current environment

Solar Flux  
`132`

Kp  
`2.3`

Path daylight  
`Mixed daylight`

Trend  
`↑ Improving`

### Interpretation

> Strong direct evidence that this path is currently open. Multiple independent reporting networks show activity between stations near your QTH and Europe during the last 30 minutes.

The explanation must be generated from rules/templates.

Do **not** use an LLM to generate condition scores or explanations.

---

# 7. Data sources

## 7.1 NOAA SWPC

Use NOAA Space Weather Prediction Center machine-readable data.

Minimum required inputs:

- F10.7 / 10.7 cm solar flux
- planetary K index
- timestamp of each observation

Optional when easily available:

- solar wind
- Bz
- X-ray flare level
- D-region absorption indicators
- NOAA space weather alerts

Poll approximately every five minutes.

Cache results.

The user-facing UI must show the age of the latest solar data.

---

# 7.2 PSKReporter

PSKReporter is the primary real-world propagation evidence source.

Prefer the real-time MQTT feed rather than aggressively polling the historical retrieval interface.

Process at least:

- band
- frequency
- mode
- transmitting callsign
- receiving callsign
- transmitting locator
- receiving locator
- transmitting DXCC
- receiving DXCC
- SNR when available
- observation timestamp

The MQTT collector must automatically reconnect with exponential backoff.

Do not assume every observation contains valid locators.

Reject obviously invalid coordinates or malformed Maidenhead locators.

### Raw data retention

Do not permanently store the complete global PSKReporter stream.

Keep enough raw data for approximately:

`60-120 minutes`

Create aggregated five-minute buckets for longer analysis.

---

# 7.3 Reverse Beacon Network

Connect to the RBN live Telnet feeds.

Use:

- CW/RTTY feed
- FT8 feed where useful

Capture:

- spotted callsign
- skimmer callsign
- frequency
- band
- SNR when present
- mode
- timestamp

Resolve station locations where possible.

RBN represents strong independent evidence because it records reception rather than simply predictions.

---

# 7.4 DX Cluster

Maintain a server-side persistent Telnet connection to one or more standard DX cluster nodes.

Cluster configuration must be externalized:

`DX_CLUSTER_HOST`

`DX_CLUSTER_PORT`

`DX_CLUSTER_CALLSIGN`

Allow an ordered failover list.

Never open one cluster connection per browser user.

The backend owns a single persistent connection and redistributes/aggregates the data.

Capture:

- spotter
- spotted callsign
- frequency
- timestamp
- comment
- source cluster

Human cluster spots should have lower statistical weight than automated reception reports because cluster usage is influenced by contests, expeditions and operator behaviour.

---

# 8. Geographic model

A reception event is relevant when one endpoint is near the user's QTH and the other endpoint is inside the selected destination region.

Do not require the local endpoint to be exactly the user's callsign.

This is a **regional propagation estimate around the QTH**.

### Locality weighting

Calculate great-circle distance between the user's QTH and the local endpoint.

Use:

`localWeight = exp(-(distanceKm / 600)^2)`

Ignore observations where:

`distanceKm > 1200`

Therefore:

- station at user's QTH receives nearly full weight,
- station 300 km away still contributes significantly,
- station 800 km away contributes modestly,
- station beyond 1200 km does not count.

This is intentionally fuzzy because ionospheric conditions are regional.

Make both `600` and `1200` configuration constants.

---

# 9. Reciprocity

Propagation can generally provide evidence in either direction.

Therefore both:

`QTH area → Europe`

and

`Europe → QTH area`

may count toward Europe conditions.

Weight observations originating near the user's QTH:

`directionWeight = 1.0`

Weight observations terminating near the user's QTH:

`directionWeight = 0.90`

This recognizes approximate path reciprocity while allowing for different antennas, receiver noise and station capability.

---

# 10. Destination classification

The remote endpoint must be classified into:

`EUROPE`

`NORTH_AMERICA`

`ASIA`

Prefer coordinates when a valid locator exists.

When a locator is unavailable, resolve callsign/DXCC using a maintained amateur-radio DXCC/CTY dataset.

Do not create a home-grown hardcoded callsign prefix list.

The selected dataset must:

- be redistributable,
- have its license documented,
- be updateable independently of application code.

Keep the geographic classification behind an interface:

`RegionResolver`

Future region definitions must not require changes to the scoring engine.

---

# 11. Recency weighting

Live conditions change quickly.

Every observation receives a recency weight.

Use exponential decay with:

`halfLifeMinutes = 15`

Formula:

`recencyWeight = 0.5 ^ (ageMinutes / 15)`

Examples:

| Age | Weight |
|---:|---:|
| now | 1.00 |
| 15 min | 0.50 |
| 30 min | 0.25 |
| 45 min | 0.125 |
| 60 min | 0.0625 |

Ignore observations older than 60 minutes for the live score.

---

# 12. Spot weighting

For every relevant observation:

`spotWeight = localWeight × directionWeight × recencyWeight`

If duplicate observations clearly represent the same transmitter/receiver/band within a very short interval, deduplicate or heavily reduce repeated weight.

One very active FT8 station must not make a band look universally excellent by itself.

---

# 13. Evidence calculation

Calculate an independent evidence score for:

- PSKReporter
- RBN
- DX Cluster

Each source produces a score from 0 through 100.

For automated reception sources, use three dimensions:

### Activity

Saturating function based on weighted spot count.

Suggested initial implementation:

`activity = 100 × (1 - exp(-weightedSpotCount / 8))`

### Diversity

Count unique transmitter/receiver combinations or unique stations.

Suggested:

`diversity = 100 × (1 - exp(-uniquePathCount / 5))`

### Signal quality

Use SNR when available.

Normalize according to source/mode before combining.

Do not compare raw FT8 SNR directly with RBN CW SNR.

If reliable normalization is not available for a source:

**omit SNR from that source rather than inventing a conversion.**

### Source evidence

Initial formula:

`sourceEvidence = 0.60 × activity + 0.40 × diversity`

SNR can later replace part of the activity weight after validation.

---

# 14. DX Cluster evidence

Human DX cluster evidence should use:

- weighted number of relevant spots,
- number of unique spotters,
- number of unique spotted stations,
- freshness.

Suggested initial formula:

`clusterActivity = 100 × (1 - exp(-weightedSpots / 5))`

`clusterDiversity = 100 × (1 - exp(-uniqueStations / 4))`

`clusterEvidence = 0.60 × clusterActivity + 0.40 × clusterDiversity`

---

# 15. Base observed-propagation score

For General mode:

`ObservedScore =`
`0.45 × PSKReporterEvidence`
`+ 0.35 × RBNEvidence`
`+ 0.20 × DXClusterEvidence`

These weights are V1 defaults, not scientific constants.

Keep all weights in configuration.

If a source is unavailable, renormalize the weights among the remaining sources.

Example:

If RBN is unavailable, do not treat RBN as zero.

Recalculate using PSKReporter and DX Cluster.

However, lower the confidence score.

---

# 16. Solar/geomagnetic modifier

Solar data must **modify actual propagation evidence**, not replace it.

Calculate:

`SolarModifier`

Range:

`-20 to +10`

### Kp penalty

Initial rules:

| Kp | Modifier |
|---:|---:|
| < 3 | 0 |
| 3-4 | -3 |
| 4-5 | -8 |
| 5-6 | -15 |
| > 6 | -20 |

### F10.7 contribution

Upper HF bands should receive some benefit from higher solar flux.

The contribution should be strongest on:

- 20m
- 17m
- 15m
- 12m
- 10m

and much smaller on:

- 160m
- 80m
- 60m
- 40m

Initial maximum positive modifier:

`+10`

Do not allow high solar flux to turn a band with no observed activity into an “Excellent” band.

Solar conditions are supporting evidence.

Actual observed propagation remains dominant.

---

# 17. Day/night path modifier

Calculate solar elevation at:

- user's QTH,
- representative midpoint of the path,
- destination representative point.

Use this only as a modest modifier.

Range:

`-10 to +10`

Examples:

Lower bands:

- night path helps 160/80/40m,
- strong daytime path can reduce score.

Upper bands:

- daylight path can help 20/17/15/12/10m,
- full darkness may reduce probability.

Do not attempt to emulate VOACAP.

This is simply a physical sanity check on the live evidence.

---

# 18. Final score

Calculate:

`FinalScore = clamp(`
`ObservedScore`
`+ SolarModifier`
`+ PathModifier,`
`0,`
`100`
`)`

Round to nearest integer.

Observations must dominate.

Example:

If:

`ObservedScore = 82`

`SolarModifier = +4`

`PathModifier = +3`

then:

`FinalScore = 89`

---

# 19. No-data behavior

Lack of spots is not proof of lack of propagation.

Therefore never blindly turn:

`0 reports`

into:

`0 propagation score`

If there is insufficient observational data:

return:

- score based on available environmental/path information,
- **Low Confidence**,
- explicit reason.

Example:

**42 - Fair**

**Confidence: Low**

> Very few stations near your QTH have reported activity on this band during the last hour. The score is therefore based mainly on current solar and path conditions.

No-data scores should generally be conservative and should not exceed approximately `60` without live evidence.

---

# 20. Confidence score

Every band/destination result requires a separate confidence score:

`0-100`

Display:

| Confidence | Label |
|---:|---|
| 0-34 | Low |
| 35-69 | Medium |
| 70-100 | High |

Confidence should consider:

- number of independent sources available,
- number of weighted observations,
- number of unique stations,
- freshness of evidence,
- availability of valid locations.

High propagation score and high confidence are different concepts.

Example:

`20m Europe: 91, High Confidence`

versus:

`10m Asia: 73, Low Confidence`

---

# 21. Trend

Calculate score snapshots every five minutes.

Compare:

`current score`

with:

`score 15 minutes ago`

Display:

`↑ Improving`

when delta ≥ +7.

Display:

`↓ Deteriorating`

when delta ≤ -7.

Otherwise:

`→ Stable`

Do not calculate a trend until enough history exists.

---

# 22. API

Main endpoint:

`GET /api/conditions`

Parameters:

- `grid`
- `lat`
- `lon`

Example conceptual request:

`/api/conditions?grid=KM72`

Response:

```json
{
  "qth": {
    "grid": "KM72",
    "lat": 32.0,
    "lon": 34.0
  },
  "generatedAt": "ISO_TIMESTAMP",
  "solar": {
    "f107": 132,
    "kp": 2.3,
    "observedAt": "ISO_TIMESTAMP"
  },
  "conditions": [
    {
      "band": "20m",
      "region": "EUROPE",
      "score": 91,
      "label": "Excellent",
      "confidence": 88,
      "confidenceLabel": "High",
      "trend": "improving",
      "components": {
        "pskReporter": 92,
        "rbn": 87,
        "dxCluster": 72,
        "observed": 86,
        "solarModifier": 3,
        "pathModifier": 2
      },
      "stats": {
        "weightedReports": 127.4,
        "uniqueStations": 39
      }
    }
  ]
}
```

The API contract must be typed.

Use a shared TypeScript schema.

Use runtime validation, for example Zod or equivalent.

---

# 23. Architecture

Use a TypeScript monorepo.

Suggested structure:

```text
/
  apps/
    web/
    collector/
  packages/
    core/
    database/
    shared/
  tests/
  SPEC.md
  AGENTS.md
  docker-compose.yml
```

### `apps/web`

Next.js application.

Responsibilities:

- UI
- QTH input
- conditions API
- detail views

### `apps/collector`

Long-running Node.js process.

Responsibilities:

- NOAA polling
- PSKReporter MQTT
- RBN Telnet
- DX Cluster Telnet
- reconnect logic
- spot normalization
- aggregation

### `packages/core`

Pure business logic:

- Maidenhead conversion
- distance calculations
- band classification
- region classification
- recency weighting
- scoring
- confidence
- trends

Core scoring functions must not depend directly on databases or network access.

This is essential for testing.

### `packages/database`

Database schema and persistence.

Use PostgreSQL.

V1 does not require TimescaleDB.

---

# 24. Data model

At minimum create:

### `solar_observations`

- timestamp
- f107
- kp
- source

### `propagation_spots`

- id
- timestamp
- source
- band
- frequency
- mode
- txCall
- rxCall
- txGrid
- rxGrid
- txLat
- txLon
- rxLat
- rxLon
- txDxcc
- rxDxcc
- snr

Raw spot retention:

approximately two hours.

### `condition_snapshots`

- timestamp
- qthGrid or calculation region
- band
- destinationRegion
- score
- confidence
- component scores

Do not indefinitely retain unnecessary raw spots.

---

# 25. Performance

The main page should not calculate conditions by scanning millions of raw observations.

Collector processes must continuously create short-window aggregates.

API target:

`< 1 second` typical server response from cached/aggregated data.

The UI must become usable within approximately two seconds on a normal broadband connection.

Live page refresh:

every five minutes.

Optional later:

WebSocket updates.

Not required in V1.

---

# 26. Resilience

Each external feed must be isolated.

If PSKReporter fails:

- RBN continues.
- DX Cluster continues.
- solar continues.

If RBN fails:

- PSKReporter continues.

If NOAA fails:

- retain last known value,
- mark it stale,
- reduce confidence if sufficiently old.

Never silently return stale data as current.

UI must indicate:

**Data source degraded**

when appropriate.

---

# 27. Privacy

Do not require login.

Do not persist a user's precise browser geolocation unless explicitly needed.

Store the preferred QTH in browser local storage.

Avoid writing raw user coordinates into application logs.

If coordinates must appear in logs for debugging, make that an explicit development-only option.

---

# 28. UI design principles

This is an instrument panel, not a marketing website.

Priorities:

1. readable at a glance,
2. desktop and mobile,
3. dark mode,
4. clear numerical values,
5. visible freshness,
6. explainability.

Avoid:

- unnecessary animations,
- large hero sections,
- stock images,
- excessive cards,
- gradients for decoration,
- AI-generated prose.

The matrix is the main product.

---

# 29. V1 exclusions

Do not implement yet:

- authentication
- payments
- user profiles
- historical charts beyond basic trend
- notifications
- AI summaries
- VOACAP forecasting
- 24-hour forecast
- country-specific scoring
- beam headings
- antenna modelling
- transmitter power modelling
- SSB/CW/digital separate dashboards
- map visualization

Design interfaces so these can be added later.

---

# 30. Testing requirements

Use automated tests.

At minimum test:

### Maidenhead

- valid 4-character locator
- valid 6-character locator
- invalid locator
- coordinate conversion

### Bands

Verify frequency to amateur-band classification.

### Geography

Verify Europe, North America and Asia classification.

### Distance

Test great-circle distance.

### Recency

Verify 15-minute half-life.

### Locality

Verify distance weighting.

### Scoring

Use fixed fixtures and make scoring deterministic.

Test:

- excellent live evidence,
- weak evidence,
- no evidence,
- missing PSKReporter,
- missing RBN,
- stale NOAA data,
- high Kp event,
- score clamping at 0 and 100.

### API

Validate response schema.

### UI

Test:

- matrix renders,
- URL grid parameter works,
- changing QTH updates results,
- detail panel opens,
- stale/degraded-data warning renders.

---

# 31. Observability

Expose basic health endpoint:

`GET /api/health`

Include status of:

- NOAA
- PSKReporter
- RBN
- DX Cluster
- database

For each data source expose:

- connected/disconnected,
- last observation timestamp,
- events received during last five minutes.

Implement structured server logging.

---

# 32. Development environment

The entire application must run locally with:

```bash
docker compose up
```

or an equally simple documented process.

Provide:

- `.env.example`
- database migration command
- seed/test fixtures
- README

Do not commit credentials.

---

# 33. Deployment assumptions

Keep deployment portable.

Expected topology:

```text
Browser
   |
   v
Next.js Web/API
   |
   v
PostgreSQL
   ^
   |
Collector service
   |
   +---- NOAA
   +---- PSKReporter
   +---- RBN
   +---- DX Cluster
```

The collector must run as a persistent service.

Do not assume serverless functions can maintain MQTT or Telnet connections.

---

# 34. Validation principle

The initial scoring constants are hypotheses.

Every score component must therefore be stored separately.

Never store only:

`score = 83`

Store enough information to reconstruct:

- PSKReporter evidence,
- RBN evidence,
- cluster evidence,
- solar modifier,
- path modifier,
- confidence.

This allows the algorithm to be recalibrated later.

---

# 35. Future calibration

V2 should allow retrospective validation.

Example question:

> When the application rated 15m Israel-to-Europe at 85+, how much observed propagation occurred during the following 15 minutes?

Eventually optimize weighting against subsequent actual reception data.

Do not implement machine learning in V1.

Simply make sure the data model preserves what will be required for this analysis.

---

# 36. Definition of Done

V1 is complete when:

1. User can open the website.
2. User can provide a Maidenhead QTH.
3. QTH can be supplied as a URL parameter.
4. Current NOAA solar information is displayed.
5. PSKReporter data is being consumed continuously.
6. RBN data is being consumed continuously.
7. At least one DX Cluster is being consumed continuously.
8. The application displays all specified HF bands.
9. Every band has Europe, North America and Asia scores.
10. Every score is between 0 and 100.
11. Clicking a score shows its component evidence.
12. Every result has a confidence level.
13. Data freshness is visible.
14. External-source failures are visible.
15. Scoring functions have automated tests.
16. Application can run locally from documented instructions.
17. No score is generated by an LLM.
18. No external source failure causes the whole application to fail.

---

# 37. Codex implementation instructions

Treat this specification as authoritative.

Do not silently change product requirements or scoring formulas.

If a technical assumption proves impossible because an external data source behaves differently from expected:

1. preserve the intended product behavior,
2. isolate the discrepancy behind an adapter,
3. document the issue,
4. implement the safest practical fallback.

Before implementing significant functionality:

- inspect existing repository contents,
- create a concise implementation plan,
- define interfaces between collectors and scoring logic.

Build incrementally.

Recommended sequence:

1. repository scaffolding,
2. Maidenhead and geographic utilities,
3. database schema,
4. NOAA collector,
5. PSKReporter collector,
6. normalized spot model,
7. scoring engine,
8. API,
9. conditions matrix UI,
10. RBN collector,
11. DX Cluster collector,
12. confidence and trend,
13. failure handling,
14. tests,
15. documentation.

After each stage:

- run tests,
- run type checking,
- run linting,
- fix failures before moving on.

Do not substitute mock data once the corresponding live-data integration has been implemented.

Mocks and fixtures are appropriate for automated tests.

---

# 38. Codex quality rules

Create an `AGENTS.md` file containing project-specific development rules.

At minimum instruct Codex that:

- `SPEC.md` is authoritative.
- Scoring logic belongs in `packages/core`.
- Scoring logic must remain deterministic.
- No scoring code may make network calls.
- External systems must be accessed through adapters.
- Every external adapter must have failure handling.
- Business logic changes require tests.
- TypeScript strict mode must remain enabled.
- Avoid `any` except where unavoidable at untrusted external boundaries.
- Validate external data before using it.
- Never hide an unavailable data source by returning fabricated values.
- Never commit secrets.
- Run the complete test suite before considering a task finished.

---

# 39. Product principle

The application must always distinguish between:

**Prediction**

and

**Observation.**

V1's competitive advantage is observation.

Ham-radio operators already have many tools telling them what propagation **should** be like.

This application should tell them:

> **What evidence do we have that this path is actually open right now?**