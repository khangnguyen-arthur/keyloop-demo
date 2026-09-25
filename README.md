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

An OpenAPI/Swagger spec was intentionally not generated for this
assessment — the contract above plus the DTOs in `src/documents/dto/` were
judged sufficient for the scope; happy to add `@nestjs/swagger` if useful.

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

## AI Collaboration Narrative

**Tooling**: Claude (Sonnet), used conversationally end-to-end — scenario
selection, scaffolding, implementation, debugging, and this README/design
doc — with me directing architecture and reviewing every diff before it
was accepted.

**High-level strategy**: I picked the scenario and the layer (backend) and
set the architectural shape up front — parallel aggregation,
circuit-breaker + timeout per upstream client, partial-failure-is-not-an-
error, SQLite for zero-setup persistence, pino + prom-client for
observability — rather than asking the AI to design from scratch. From
there I had it scaffold the NestJS module structure and implementation
file-by-file, reviewing each piece (client wrapper, aggregation service,
mock controllers, entity) against that plan before moving to the next.

**Verifying and refining the output — concretely, not just "I reviewed it"**:

1. The first scaffold attempt (via `nest new`, which currently defaults to
   a Vitest-based template) failed to `npm install` with an internal
   `npm/@npmcli/arborist` crash (`Cannot read properties of null
   (reading 'edgesOut')`) unrelated to anything in this project. Rather
   than fight that toolchain, I redirected to a manually-authored,
   Jest-based `package.json` with pinned, known-stable NestJS 10 versions
   — a judgment call about which battle was worth fighting.
2. After the first `nest build` succeeded, I ran the server and manually
   curled every scenario (happy path, partial, unknown VIN, forced
   upstream failure). **All four returned 503 "both systems
   unavailable"** — including the happy path, which should have worked.
   I diagnosed this myself by reading the exception filter's structured
   log output rather than trusting a green build: the clients were
   calling `/mock/sales-system/documents`, but the app's global
   `VersioningType.URI` prefix meant the actual route was
   `/v1/mock/sales-system/documents`. Fixed by updating both client
   `documentsPath` values, with a code comment explaining *why* the `/v1`
   segment is there (so a future reader doesn't "fix" it back).
3. Wrote the circuit-breaker unit tests to prove the *specific* claims I
   was making, not just "it doesn't crash": that a short-circuited call
   never invokes the wrapped function (`expect(spy).not.toHaveBeenCalled()`),
   that a success resets the failure streak rather than just closing the
   circuit, and that HALF_OPEN re-trips on a failed trial. One test
   initially failed until I fixed an off-by-one in my own threshold
   assertion, not the implementation.
4. The e2e suite initially failed all three business-logic tests with the
   same symptom as #2 but a different cause: supertest's
   `app.getHttpServer()` doesn't bind a real port by default, but the app
   under test calls **itself** over real HTTP as its own mocked upstream.
   Fixed by pinning a real port for the test run and pointing the
   upstream client base URLs at it via env vars set before module init —
   documented inline in the test file so the reason isn't a mystery six
   months from now.
5. Manually re-ran the full curl matrix (including tripping the circuit
   breaker 4 times in a row) after every structural change, not just at
   the end, to catch regressions immediately rather than debug a pile of
   changes at once.

**Ownership**: every file in `src/` was read and, where something looked
off (silent audit-log failures shouldn't break a search response; VIN test
fixtures needed to actually be 17 characters to pass DTO validation —
caught two fixtures that weren't and fixed them), corrected before moving
on. Nothing here is unreviewed AI output — I can defend every architectural
decision and every line of the resilience logic in the walkthrough video.
