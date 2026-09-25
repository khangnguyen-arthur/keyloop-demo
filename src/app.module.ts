import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { DocumentsModule } from './documents/documents.module';
import { MockExternalSystemsModule } from './mock-external-systems/mock-external-systems.module';
import { PersistenceModule } from './persistence/persistence.module';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { SearchAuditEntity } from './persistence/entities/search-audit.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req: any) => req.headers['x-correlation-id'] || randomUUID(),
        customProps: (req: any) => ({ correlationId: req.id }),
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        transport:
          process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization'],
      },
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || 'data/document-viewer.sqlite',
      entities: [SearchAuditEntity],
      synchronize: true, // acceptable for this assessment scope; see README for prod guidance
    }),
    CommonModule,
    PersistenceModule,
    MockExternalSystemsModule,
    DocumentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
