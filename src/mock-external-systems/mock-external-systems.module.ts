import { Module } from '@nestjs/common';
import { SalesSystemMockController } from './sales-system-mock.controller';
import { ServiceSystemMockController } from './service-system-mock.controller';

/**
 * These controllers exist ONLY to stand in for the two external dealership
 * systems named in the assessment brief ("Sales System API" / "Service
 * System API"). In a real deployment they would not be part of this
 * service at all — see the System Design Document for the production
 * topology (this module would be deleted and the clients pointed at real
 * upstream base URLs via configuration).
 */
@Module({
  controllers: [SalesSystemMockController, ServiceSystemMockController],
})
export class MockExternalSystemsModule {}
