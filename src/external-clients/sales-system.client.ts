import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseDocumentSourceClient } from './base-document-source.client';
import { MetricsService } from '../common/metrics.service';
import { SourceSystem } from './document-source.interface';

@Injectable()
export class SalesSystemClient extends BaseDocumentSourceClient {
  readonly sourceSystem: SourceSystem = 'SALES';
  protected readonly baseUrl: string;
  // NOTE: '/v1' matches this app's own global URI-versioning prefix, since
  // the mocked Sales System lives inside this same service for the
  // assessment. Point SALES_SYSTEM_BASE_URL at a real external host in
  // production and this path would not need a version segment.
  protected readonly documentsPath = '/v1/mock/sales-system/documents';

  constructor(http: HttpService, metrics: MetricsService, config: ConfigService) {
    super(
      http,
      metrics,
      'SalesSystemClient',
      config.get<number>('SALES_SYSTEM_TIMEOUT_MS', 3000),
    );
    this.baseUrl = config.get<string>('SALES_SYSTEM_BASE_URL', 'http://localhost:3000');
  }
}
