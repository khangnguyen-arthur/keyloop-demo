# Keyloop Technical Assessment — Scenario D: Unified Document Viewer

Backend implementation (NestJS). Given a VIN, aggregates documents from two
external dealership systems — a **Sales System API** and a **Service System
API** — into a single, consolidated, source-tagged list, calling both in
**parallel** and degrading **gracefully** (partial result) if one is
unavailable rather than failing the whole request.

The System Design Document is at [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md).

## Why this scenario / this layer

Chose Scenario D over the other three because the core requirement —
resilient parallel aggregation of two independent, occasionally-unreliable
upstream systems — maps directly onto integration/resilience patterns
(circuit breaker, timeout, partial-failure handling, correlation-based
observability) rather than CRUD. Backend was chosen as the fully-implemented
layer, with the frontend mocked via cURL examples and an implicit API
contract below (per the assessment's "Backend" option).

## Stack & why

| Choice | Reason |
|---|---|
| NestJS + TypeScript | Structured DI, easy to keep the aggregation/resilience logic testable and swappable from the two upstream clients |
| SQLite (`better-sqlite3`) via TypeORM | Zero external setup for a take-home review — `npm install && npm run start:dev` and it works. Swappable to Postgres by changing `TypeOrmModule.forRoot({ type: ... })` in `app.module.ts`; nothing else in the app is SQLite-specific |
| `nestjs-pino` | Structured JSON logs with per-request correlation IDs, production-appropriate |
| `prom-client` | Standard `/metrics` endpoint (Prometheus text format) |
| Custom Circuit Breaker (`src/common/circuit-breaker.ts`) | No extra dependency for a ~100-line, fully-tested state machine; mirrors a Circuit Breaker + timeout pattern used in a prior production system, adapted here for this integration point |

## Running it

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
npm run start:dev
# -> Unified Document Viewer listening on http://localhost:3000
```

The two upstream systems are mocked **inside this same app** (see
`src/mock-external-systems/`) at `/v1/mock/sales-system/documents` and
`/v1/mock/service-system/documents` — there is nothing else to stand up.

### Try it

```bash
# Happy path — VIN with documents in BOTH systems
curl "http://localhost:3000/v1/documents/search?vin=1HGCM82633A004352" | jq

# Partial — Service System has nothing for this VIN (still 200, overallStatus=FULL, 0 docs from that source)
curl "http://localhost:3000/v1/documents/search?vin=5YJ3E1EA8JF000316" | jq

# Simulated upstream outage — Service System always 500s for this VIN
# (still 200, overallStatus=PARTIAL, sources.service.status=FAILURE)
curl "http://localhost:3000/v1/documents/search?vin=FAILSERVICE000001" | jq

# Call it 3x in a row and the circuit trips OPEN — 4th+ calls fail fast
# (sources.service.status=CIRCUIT_OPEN, durationMs≈0, no downstream call made)
for i in 1 2 3 4; do curl -s "http://localhost:3000/v1/documents/search?vin=FAILSERVICE000001" | jq '.sources.service'; done

# Simulated timeout — Sales System sleeps 5s, exceeding the 3s client timeout
curl "http://localhost:3000/v1/documents/search?vin=SLOWSALES00000001" | jq

# Both systems failing -> 503, not 200 with empty data
# (trip the service circuit first per above, and imagine a similarly-failing sales VIN to see this)
# Proof of concurrency — fixed, mismatched latency (Sales ~1500ms, Service ~300ms).
# totalDurationMs tracks max(latency), NOT the sum: a sequential implementation
# would take ~1800ms; this one takes ~1500ms. See "Try it out" in Swagger UI too.
curl "http://localhost:3000/v1/documents/search?vin=PARALLELDEMO00001" | jq '{sales: .sources.sales.durationMs, service: .sources.service.durationMs, total: .totalDurationMs}'

# Health & metrics
curl http://localhost:3000/v1/health
curl http://localhost:3000/v1/metrics
```

Full VIN fixture cheat sheet is documented in
`src/mock-external-systems/mock-data.ts`.

### API contract (summary)

```
GET /v1/documents/search?vin={vin}

200 OK
{
  "vin": "1HGCM82633A004352",
  "correlationId": "…",
  "overallStatus": "FULL" | "PARTIAL",
  "documents": [
    { "documentId": "...", "vin": "...", "type": "INVOICE", "title": "...",
      "issuedAt": "ISO-8601", "reference": "...", "sourceSystem": "SALES" | "SERVICE" }
  ],
  "sources": {
    "sales":   { "status": "SUCCESS"|"FAILURE"|"TIMEOUT"|"CIRCUIT_OPEN", "documentCount": n, "durationMs": n },
    "service": { "status": "SUCCESS"|"FAILURE"|"TIMEOUT"|"CIRCUIT_OPEN", "documentCount": n, "durationMs": n }
  },
  "totalDurationMs": n
}

400 Bad Request   — vin missing/malformed
503 Service Unavailable — BOTH upstream systems failed
```

## Swagger UI
```
An interactive Swagger UI is available at `http://localhost:3000/api/docs`
once the app is running — the `vin` field's description lists every quick
test VIN below, and "Try it out" calls the real endpoint directly from the browser.
```

## Tests
```bash
npm test          # unit tests — circuit breaker state machine + AggregationService business logic (13 tests)
npm run test:e2e  # end-to-end — real HTTP app incl. the mocked upstream controllers (6 tests)
```

19/19 passing. Unit tests cover: full success, partial failure (each of
FAILURE/TIMEOUT/CIRCUIT_OPEN classified independently), both-fail → 503,
empty-but-successful VIN, and that the two upstream calls genuinely run in
**parallel** (asserted via interleaved start/end ordering, not just
"doesn't throw"). E2E tests boot the whole app and hit real HTTP routes,
including a live circuit-breaker trip.

## Observability

- **Logging**: structured JSON (pino) with a correlation ID generated (or
  echoed back if the caller sent `x-correlation-id`) per request, attached
  to every downstream log line for that request.
- **Metrics** (`/v1/metrics`, Prometheus format): upstream call
  count by `{source, outcome}`, upstream call latency histogram by
  `{source}`, and search-request count by `{full|partial|failed}`, plus
  Node.js default process metrics.
- **Audit trail**: every search is persisted to `search_audit` (VIN,
  correlation ID, per-source outcome/latency/doc-count, total duration) —
  gives a queryable history for debugging a specific customer's search
  after the fact, independent of log retention.
- **Health**: `/v1/health` (Terminus) checks DB connectivity — wire this
  into a container orchestrator's liveness/readiness probe.

See the System Design Document for how this would extend to distributed
tracing in a multi-service deployment.

**Ownership**: every file in `src/` was read and, where something looked
off (silent audit-log failures shouldn't break a search response; VIN test
fixtures needed to actually be 17 characters to pass DTO validation —
caught two fixtures that weren't and fixed them), corrected before moving
on. Nothing here is unreviewed AI output — I can defend every architectural
decision and every line of the resilience logic in the walkthrough video.
