process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
// The two "upstream systems" the app calls are mocked controllers inside
// this SAME process, so the app must know its own address to call itself.
// We pin a fixed port here (rather than an ephemeral one) precisely so it
// can be known before the app boots and handed to it via env vars, which
// ConfigService reads at module-init time.
const E2E_PORT = 4010;
process.env.SALES_SYSTEM_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
process.env.SERVICE_SYSTEM_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Documents (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(E2E_PORT);
  });

  afterAll(async () => {
    await app.close();
  });

  const baseUrl = () => `http://127.0.0.1:${E2E_PORT}`;

  it('GET /v1/health returns 200', async () => {
    await request(baseUrl()).get('/v1/health').expect(200);
  });

  it('GET /v1/documents/search returns a FULL, source-tagged result for a VIN present in both systems', async () => {
    const res = await request(baseUrl())
      .get('/v1/documents/search')
      .query({ vin: '1HGCM82633A004352' })
      .expect(200);

    expect(res.body.overallStatus).toBe('FULL');
    expect(res.body.documents.length).toBeGreaterThanOrEqual(2);
    const sources = res.body.documents.map((d: any) => d.sourceSystem).sort();
    expect(sources).toEqual(expect.arrayContaining(['SALES', 'SERVICE']));
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('GET /v1/documents/search returns PARTIAL and still 200 when one upstream system errors', async () => {
    const res = await request(baseUrl())
      .get('/v1/documents/search')
      .query({ vin: 'FAILSERVICE000001' })
      .expect(200);

    expect(res.body.overallStatus).toBe('PARTIAL');
    expect(res.body.sources.service.status).toBe('FAILURE');
  });

  it('GET /v1/documents/search returns 400 for a malformed VIN', async () => {
    const res = await request(baseUrl())
      .get('/v1/documents/search')
      .query({ vin: '#$%' })
      .expect(400);

    expect(res.body.correlationId).toBeDefined();
  });

  it('GET /v1/documents/search returns 400 when the vin query param is missing', async () => {
    await request(baseUrl()).get('/v1/documents/search').expect(400);
  });

  it('echoes a client-supplied x-correlation-id back on the response', async () => {
    const res = await request(baseUrl())
      .get('/v1/documents/search')
      .set('x-correlation-id', 'my-fixed-id-123')
      .query({ vin: 'WBA3A5C50DF000001' })
      .expect(200);

    expect(res.headers['x-correlation-id']).toBe('my-fixed-id-123');
    expect(res.body.correlationId).toBe('my-fixed-id-123');
  });
});
