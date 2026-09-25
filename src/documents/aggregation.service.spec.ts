import { ServiceUnavailableException } from '@nestjs/common';
import { AggregationService } from './aggregation.service';
import { SalesSystemClient } from '../external-clients/sales-system.client';
import { ServiceSystemClient } from '../external-clients/service-system.client';
import { MetricsService } from '../common/metrics.service';
import { SearchAuditService } from '../persistence/search-audit.service';
import { CircuitOpenError } from '../common/circuit-breaker';
import { UpstreamTimeoutError, UpstreamUnavailableError } from '../external-clients/base-document-source.client';
import { SourceDocument } from '../external-clients/document-source.interface';

const salesDoc: SourceDocument = {
  documentId: 'S1',
  vin: 'VIN123',
  type: 'INVOICE',
  title: 'Invoice',
  issuedAt: '2025-01-01T00:00:00.000Z',
  reference: 'REF-1',
};

const serviceDoc: SourceDocument = {
  documentId: 'W1',
  vin: 'VIN123',
  type: 'WORK_ORDER',
  title: 'Work Order',
  issuedAt: '2025-02-01T00:00:00.000Z',
  reference: 'REF-2',
};

describe('AggregationService', () => {
  let salesClient: jest.Mocked<Pick<SalesSystemClient, 'fetchDocuments'>>;
  let serviceClient: jest.Mocked<Pick<ServiceSystemClient, 'fetchDocuments'>>;
  let metrics: MetricsService;
  let auditService: jest.Mocked<Pick<SearchAuditService, 'record'>>;
  let service: AggregationService;

  beforeEach(() => {
    salesClient = { fetchDocuments: jest.fn() };
    serviceClient = { fetchDocuments: jest.fn() };
    metrics = new MetricsService();
    auditService = { record: jest.fn().mockResolvedValue(undefined) };

    service = new AggregationService(
      salesClient as unknown as SalesSystemClient,
      serviceClient as unknown as ServiceSystemClient,
      metrics,
      auditService as unknown as SearchAuditService,
    );
  });

  it('returns FULL result with documents tagged by source when both systems succeed', async () => {
    salesClient.fetchDocuments.mockResolvedValue([salesDoc]);
    serviceClient.fetchDocuments.mockResolvedValue([serviceDoc]);

    const result = await service.searchByVin('VIN123', 'corr-1');

    expect(result.overallStatus).toBe('FULL');
    expect(result.documents).toEqual([
      { ...salesDoc, sourceSystem: 'SALES' },
      { ...serviceDoc, sourceSystem: 'SERVICE' },
    ]);
    expect(result.sources.sales.status).toBe('SUCCESS');
    expect(result.sources.service.status).toBe('SUCCESS');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ vin: 'VIN123', overallOutcome: 'FULL' }),
    );
  });

  it('returns PARTIAL result when only one system succeeds, without throwing', async () => {
    salesClient.fetchDocuments.mockResolvedValue([salesDoc]);
    serviceClient.fetchDocuments.mockRejectedValue(new UpstreamUnavailableError('down'));

    const result = await service.searchByVin('VIN123', 'corr-2');

    expect(result.overallStatus).toBe('PARTIAL');
    expect(result.documents).toEqual([{ ...salesDoc, sourceSystem: 'SALES' }]);
    expect(result.sources.sales.status).toBe('SUCCESS');
    expect(result.sources.service.status).toBe('FAILURE');
    expect(result.sources.service.errorMessage).toContain('down');
  });

  it('classifies a timeout distinctly from a generic failure', async () => {
    salesClient.fetchDocuments.mockRejectedValue(new UpstreamTimeoutError('too slow'));
    serviceClient.fetchDocuments.mockResolvedValue([serviceDoc]);

    const result = await service.searchByVin('VIN123', 'corr-3');

    expect(result.overallStatus).toBe('PARTIAL');
    expect(result.sources.sales.status).toBe('TIMEOUT');
  });

  it('classifies an open circuit distinctly and still returns a PARTIAL result', async () => {
    salesClient.fetchDocuments.mockResolvedValue([salesDoc]);
    serviceClient.fetchDocuments.mockRejectedValue(new CircuitOpenError('ServiceSystemClient'));

    const result = await service.searchByVin('VIN123', 'corr-4');

    expect(result.overallStatus).toBe('PARTIAL');
    expect(result.sources.service.status).toBe('CIRCUIT_OPEN');
  });

  it('throws ServiceUnavailableException (503) when BOTH systems fail, after recording the audit', async () => {
    salesClient.fetchDocuments.mockRejectedValue(new UpstreamUnavailableError('sales down'));
    serviceClient.fetchDocuments.mockRejectedValue(new UpstreamUnavailableError('service down'));

    await expect(service.searchByVin('VIN123', 'corr-5')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ overallOutcome: 'FAILED' }),
    );
  });

  it('returns FULL (empty) when both systems succeed with no documents for the VIN', async () => {
    salesClient.fetchDocuments.mockResolvedValue([]);
    serviceClient.fetchDocuments.mockResolvedValue([]);

    const result = await service.searchByVin('UNKNOWNVIN', 'corr-6');

    expect(result.overallStatus).toBe('FULL');
    expect(result.documents).toEqual([]);
  });

  it('calls both clients in parallel rather than sequentially', async () => {
    const order: string[] = [];
    salesClient.fetchDocuments.mockImplementation(async () => {
      order.push('sales-start');
      await new Promise((r) => setTimeout(r, 30));
      order.push('sales-end');
      return [salesDoc];
    });
    serviceClient.fetchDocuments.mockImplementation(async () => {
      order.push('service-start');
      await new Promise((r) => setTimeout(r, 10));
      order.push('service-end');
      return [serviceDoc];
    });

    await service.searchByVin('VIN123', 'corr-7');

    // Both must start before either finishes — proves they run concurrently,
    // not sequentially (service, being faster, finishes before sales).
    expect(order).toEqual(['sales-start', 'service-start', 'service-end', 'sales-end']);
  });
});
