import { Controller, Get, Query } from '@nestjs/common';
import { SALES_SYSTEM_DOCUMENTS, SLOW_SALES_VIN } from './mock-data';
import { ApiExcludeController } from '@nestjs/swagger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stands in for the dealership's external "Sales System API". In a real
 * deployment this would be an entirely separate, independently-owned
 * service reachable only over HTTP — so the aggregator must treat it as an
 * untrusted, possibly slow or unavailable dependency.
 */
@ApiExcludeController()
@Controller('mock/sales-system')
export class SalesSystemMockController {
  @Get('documents')
  async getDocuments(@Query('vin') vin: string) {
    // Simulate realistic network + processing latency.
    if (vin === SLOW_SALES_VIN) {
      await sleep(5000); // deliberately exceeds the client's call timeout
    } else {
      await sleep(80 + Math.random() * 220);
    }

    return {
      system: 'SALES_SYSTEM',
      vin,
      documents: SALES_SYSTEM_DOCUMENTS[vin] ?? [],
    };
  }
}
