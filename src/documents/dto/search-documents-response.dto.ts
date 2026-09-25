import { SourceDocument, SourceSystem } from '../../external-clients/document-source.interface';
import { SourceCallOutcome } from '../../persistence/entities/search-audit.entity';

export interface UnifiedDocument extends SourceDocument {
  sourceSystem: SourceSystem;
}

export interface SourceResultSummary {
  status: SourceCallOutcome;
  documentCount: number;
  durationMs: number;
  /** Present only when status !== 'SUCCESS'. Human-readable, never a raw stack trace. */
  errorMessage?: string;
}

export interface SearchDocumentsResponseDto {
  vin: string;
  correlationId: string;
  /** FULL = both sources succeeded, PARTIAL = one source failed, FAILED = both failed. */
  overallStatus: 'FULL' | 'PARTIAL' | 'FAILED';
  documents: UnifiedDocument[];
  sources: {
    sales: SourceResultSummary;
    service: SourceResultSummary;
  };
  totalDurationMs: number;
}
