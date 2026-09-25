import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { AggregationService } from './aggregation.service';
import { ExternalClientsModule } from '../external-clients/external-clients.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [ExternalClientsModule, PersistenceModule, CommonModule],
  controllers: [DocumentsController],
  providers: [AggregationService],
})
export class DocumentsModule {}
