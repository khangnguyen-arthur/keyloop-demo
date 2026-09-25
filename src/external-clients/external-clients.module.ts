import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CommonModule } from '../common/common.module';
import { SalesSystemClient } from './sales-system.client';
import { ServiceSystemClient } from './service-system.client';

@Module({
  imports: [HttpModule, CommonModule],
  providers: [SalesSystemClient, ServiceSystemClient],
  exports: [SalesSystemClient, ServiceSystemClient],
})
export class ExternalClientsModule {}
