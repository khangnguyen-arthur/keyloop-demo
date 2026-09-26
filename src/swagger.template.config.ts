import { DocumentBuilder } from '@nestjs/swagger';
 
const SWAGGER_CONFIGURATION = new DocumentBuilder()
  .setTitle('Keyloop Unified Document Viewer')
  .setDescription(
    'Scenario D: given a VIN, aggregates documents from the mocked Sales System API and Service System API in parallel. ' +
      'Use the "Quick VIN" values below with GET /v1/documents/search to exercise every case (full, partial, circuit breaker, timeout).',
  )
  .setVersion('1.0')
  .addTag('documents', 'The real feature: unified, source tagged document search')
  .addTag('mock sales system', 'Stand in for the external Sales System API (not part of production topology)')
  .addTag('mock service system', 'Stand in for the external Service System API (not part of production topology)')
  .addTag('observability', 'Health and metrics endpoints')
  .build();

export const swaggerConfiguration = SWAGGER_CONFIGURATION;
