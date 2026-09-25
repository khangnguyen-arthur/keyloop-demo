import { Controller, Get, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AggregationService } from './aggregation.service';
import { SearchDocumentsQueryDto } from './dto/search-documents-query.dto';
import { SearchDocumentsResponseDto } from './dto/search-documents-response.dto';

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
  async search(
    @Query() query: SearchDocumentsQueryDto,
    @Req() req: Request,
  ): Promise<SearchDocumentsResponseDto> {
    const correlationId = (req as any).correlationId as string;
    return this.aggregationService.searchByVin(query.vin.toUpperCase(), correlationId);
  }
}
