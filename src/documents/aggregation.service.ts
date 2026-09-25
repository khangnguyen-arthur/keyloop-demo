import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SalesSystemClient } from '../external-clients/sales-system.client';
import { ServiceSystemClient } from '../external-clients/service-system.client';
import { SourceDocument } from '../external-clients/document-source.interface';
import { CircuitOpenError } from '../common/circuit-breaker';
import { UpstreamTimeoutError } from '../external-clients/base-document-source.client';
import { MetricsService } from '../common/metrics.service';
import { SearchAuditService } from '../persistence/search-audit.service';
import { SourceCallOutcome } from '../persistence/entities/search-audit.entity';
import { SearchDocumentsResponseDto, SourceResultSummary, UnifiedDocument } from './dto/search-documents-response.dto';

interface SourceCallResult {
  outcome: SourceCallOutcome;
  documents: SourceDocument[];
  durationMs: number;
  errorMessage?: string;
}

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(
    private readonly salesClient: SalesSystemClient,
    private readonly serviceClient: ServiceSystemClient,
    private readonly metrics: MetricsService,
    private readonly auditService: SearchAuditService,
  ) {}

  async searchByVin(vin: string, correlationId: string): Promise<SearchDocumentsResponseDto> {
    const overallStart = Date.now();

    const [salesResult, serviceResult] = await Promise.all([
      this.callSource(() => this.salesClient.fetchDocuments(vin, correlationId)),
      this.callSource(() => this.serviceClient.fetchDocuments(vin, correlationId)),
    ]);

    const totalDurationMs = Date.now() - overallStart;

    const documents: UnifiedDocument[] = [
      ...salesResult.documents.map((d) => ({ ...d, sourceSystem: 'SALES' as const })),
      ...serviceResult.documents.map((d) => ({ ...d, sourceSystem: 'SERVICE' as const })),
    ];

    const overallStatus = this.computeOverallStatus(salesResult.outcome, serviceResult.outcome);

    this.metrics.searchRequestsTotal.inc({
      outcome: overallStatus === 'FULL' ? 'full' : overallStatus === 'PARTIAL' ? 'partial' : 'failed',
    });

    await this.auditService.record({
      vin,
      correlationId,
      salesOutcome: salesResult.outcome,
      salesDurationMs: salesResult.durationMs,
      salesDocumentCount: salesResult.documents.length,
      serviceOutcome: serviceResult.outcome,
      serviceDurationMs: serviceResult.durationMs,
      serviceDocumentCount: serviceResult.documents.length,
      totalDurationMs,
      overallOutcome: overallStatus,
    });

    if (overallStatus === 'FAILED') {
      this.logger.error(`Both upstream systems unavailable for vin=${vin} correlationId=${correlationId}`);
      throw new ServiceUnavailableException({
        message: 'Both Sales System and Service System are currently unavailable. Please retry shortly.',
        vin,
        correlationId,
      });
    }

    if (overallStatus === 'PARTIAL') {
      this.logger.warn(
        `Partial result for vin=${vin}: sales=${salesResult.outcome} service=${serviceResult.outcome} correlationId=${correlationId}`,
      );
    }

    const response: SearchDocumentsResponseDto = {
      vin,
      correlationId,
      overallStatus,
      documents,
      sources: {
        sales: this.toSummary(salesResult),
        service: this.toSummary(serviceResult),
      },
      totalDurationMs,
    };

    return response;
  }

  private async callSource(fn: () => Promise<SourceDocument[]>): Promise<SourceCallResult> {
    const start = Date.now();
    try {
      const documents = await fn();
      return { outcome: 'SUCCESS', documents, durationMs: Date.now() - start };
    } catch (err) {
      const durationMs = Date.now() - start;
      if (err instanceof CircuitOpenError) {
        return { outcome: 'CIRCUIT_OPEN', documents: [], durationMs, errorMessage: err.message };
      }
      if (err instanceof UpstreamTimeoutError) {
        return { outcome: 'TIMEOUT', documents: [], durationMs, errorMessage: err.message };
      }
      return { outcome: 'FAILURE', documents: [], durationMs, errorMessage: (err as Error).message };
    }
  }

  private toSummary(result: SourceCallResult): SourceResultSummary {
    return {
      status: result.outcome,
      documentCount: result.documents.length,
      durationMs: result.durationMs,
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    };
  }

  private computeOverallStatus(
    salesOutcome: SourceCallOutcome,
    serviceOutcome: SourceCallOutcome,
  ): 'FULL' | 'PARTIAL' | 'FAILED' {
    const salesOk = salesOutcome === 'SUCCESS';
    const serviceOk = serviceOutcome === 'SUCCESS';
    if (salesOk && serviceOk) return 'FULL';
    if (salesOk || serviceOk) return 'PARTIAL';
    return 'FAILED';
  }
}
