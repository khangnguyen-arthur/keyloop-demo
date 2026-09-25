import { Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { CircuitBreaker, CircuitOpenError } from '../common/circuit-breaker';
import { MetricsService } from '../common/metrics.service';
import { DocumentSourceClient, SourceDocument, SourceSystem } from './document-source.interface';

export class UpstreamTimeoutError extends Error {}
export class UpstreamUnavailableError extends Error {}

export abstract class BaseDocumentSourceClient implements DocumentSourceClient {
  protected readonly logger: Logger;
  protected readonly circuitBreaker: CircuitBreaker;

  abstract readonly sourceSystem: SourceSystem;
  protected abstract readonly baseUrl: string;
  protected abstract readonly documentsPath: string;

  constructor(
    protected readonly http: HttpService,
    protected readonly metrics: MetricsService,
    circuitName: string,
    private readonly callTimeoutMs = 3000,
  ) {
    this.logger = new Logger(circuitName);
    this.circuitBreaker = new CircuitBreaker(circuitName, {
      failureThreshold: 3,
      resetTimeoutMs: 10_000,
      callTimeoutMs: this.callTimeoutMs,
    });
  }

  async fetchDocuments(vin: string, correlationId: string): Promise<SourceDocument[]> {
    const timer = this.metrics.upstreamCallDuration.startTimer({ source: this.sourceSystem });
    const startedAt = Date.now();

    try {
      const result = await this.circuitBreaker.execute(() =>
        firstValueFrom(
          this.http.get(`${this.baseUrl}${this.documentsPath}`, {
            params: { vin },
            timeout: this.callTimeoutMs,
            headers: { 'x-correlation-id': correlationId },
          }),
        ),
      );

      timer();
      this.metrics.upstreamCallsTotal.inc({ source: this.sourceSystem, outcome: 'success' });
      this.logger.log(
        `fetchDocuments OK vin=${vin} durationMs=${Date.now() - startedAt} correlationId=${correlationId}`,
      );
      return result.data.documents ?? [];
    } catch (err) {
      timer();

      if (err instanceof CircuitOpenError) {
        this.metrics.upstreamCallsTotal.inc({ source: this.sourceSystem, outcome: 'circuit_open' });
        this.logger.warn(`fetchDocuments SHORT-CIRCUITED vin=${vin} correlationId=${correlationId}`);
        throw err;
      }

      const isTimeout = (err as Error).message?.includes('timed out');
      const outcome = isTimeout ? 'timeout' : 'failure';
      this.metrics.upstreamCallsTotal.inc({ source: this.sourceSystem, outcome });

      const status = (err as AxiosError)?.response?.status;
      this.logger.error(
        `fetchDocuments FAILED vin=${vin} status=${status ?? 'n/a'} correlationId=${correlationId} reason=${(err as Error).message}`,
      );

      if (isTimeout) {
        throw new UpstreamTimeoutError(`${this.sourceSystem} timed out for vin=${vin}`);
      }
      throw new UpstreamUnavailableError(`${this.sourceSystem} unavailable for vin=${vin}`);
    }
  }
}
