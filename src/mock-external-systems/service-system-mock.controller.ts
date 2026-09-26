import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { FAILING_SERVICE_VIN, SERVICE_SYSTEM_DOCUMENTS } from './mock-data';
import { ApiExcludeController } from '@nestjs/swagger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stands in for the dealership's external "Service System API".
 * `FAILSERVICE0000001` always returns a 500 so the aggregation layer's
 * partial-failure and circuit-breaker behaviour can be demonstrated and
 * tested deterministically.
 */
@ApiExcludeController()
@Controller('mock/service-system')
export class ServiceSystemMockController {
  @Get('documents')
  async getDocuments(@Query('vin') vin: string) {
    await sleep(80 + Math.random() * 220);

    if (vin === FAILING_SERVICE_VIN) {
      throw new HttpException(
        { system: 'SERVICE_SYSTEM', message: 'Simulated upstream outage' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      system: 'SERVICE_SYSTEM',
      vin,
      documents: SERVICE_SYSTEM_DOCUMENTS[vin] ?? [],
    };
  }
}
