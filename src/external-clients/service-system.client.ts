import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseDocumentSourceClient } from './base-document-source.client';
import { MetricsService } from '../common/metrics.service';
import { SourceSystem } from './document-source.interface';

@Injectable()
export class ServiceSystemClient extends BaseDocumentSourceClient {
  readonly sourceSystem: SourceSystem = 'SERVICE';
  protected readonly baseUrl: string;
  // See note in SalesSystemClient re: the '/v1' segment.
  protected readonly documentsPath = '/v1/mock/service-system/documents';

  constructor(http: HttpService, metrics: MetricsService, config: ConfigService) {
    super(
      http,
      metrics,
      'ServiceSystemClient',
      config.get<number>('SERVICE_SYSTEM_TIMEOUT_MS', 3000),
    );
    this.baseUrl = config.get<string>('SERVICE_SYSTEM_BASE_URL', 'http://localhost:3000');
  }
}
