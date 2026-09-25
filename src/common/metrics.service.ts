import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly upstreamCallsTotal = new Counter({
    name: 'document_viewer_upstream_calls_total',
    help: 'Total calls made to upstream (mocked) document source systems',
    labelNames: ['source', 'outcome'] as const, // outcome: success|failure|timeout|circuit_open
    registers: [this.registry],
  });

  readonly upstreamCallDuration = new Histogram({
    name: 'document_viewer_upstream_call_duration_seconds',
    help: 'Latency of calls to upstream document source systems',
    labelNames: ['source'] as const,
    buckets: [0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5],
    registers: [this.registry],
  });

  readonly searchRequestsTotal = new Counter({
    name: 'document_viewer_search_requests_total',
    help: 'Total VIN search requests handled',
    labelNames: ['outcome'] as const, // full|partial|failed
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
