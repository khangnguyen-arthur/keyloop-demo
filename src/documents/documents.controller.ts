import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AggregationService } from './aggregation.service';
import { SearchDocumentsQueryDto } from './dto/search-documents-query.dto';
import { SearchDocumentsResponseDto } from './dto/search-documents-response.dto';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { documentSchemaMockExample } from './mock/document.mock';

@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly aggregationService: AggregationService) {}

  /**
   * Unified Search: given a VIN, aggregates documents from the Sales System
   * API and the Service System API in parallel and returns a single,
   * consolidated list — tagged by source — even if one upstream system is
   * temporarily unavailable (PARTIAL result) rather than failing the whole
   * request.
   */
  @Get('search')
  @ApiOperation({
    summary: 'Unified document search by VIN',
    description:
      `Calls the Sales System API and Service System API in parallel, merges the results,
      and tags every document with its sourceSystem. Returns 200 with overallStatus=PARTIAL,
      (rather than an error) when exactly one upstream system fails, and only returns 503 when both fail`,
  })
  @ApiOkResponse({
    description: 'FULL or PARTIAL result (check overallStatus and sources.* for per source detail)',
    schema: {
      example: documentSchemaMockExample,
    },
  })
  @ApiBadRequestResponse({ description: 'vin is missing or not 5 to 17 alphanumeric characters' })
  @ApiServiceUnavailableResponse({ description: 'Both Sales System and Service System failed for this VIN' })
  async search(
    @Query() query: SearchDocumentsQueryDto,
    @Req() req: Request,
  ): Promise<SearchDocumentsResponseDto> {
    const correlationId = (req as any).correlationId as string;
    return this.aggregationService.searchByVin(query.vin.toUpperCase(), correlationId);
  }
}
