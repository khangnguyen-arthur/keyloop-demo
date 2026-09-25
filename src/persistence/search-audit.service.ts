import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchAuditEntity } from './entities/search-audit.entity';

@Injectable()
export class SearchAuditService {
  private readonly logger = new Logger(SearchAuditService.name);

  constructor(
    @InjectRepository(SearchAuditEntity)
    private readonly repo: Repository<SearchAuditEntity>,
  ) {}

  async record(entry: Omit<SearchAuditEntity, 'id' | 'createdAt'>): Promise<SearchAuditEntity> {
    try {
      const saved = await this.repo.save(this.repo.create(entry));
      return saved;
    } catch (err) {
      // Audit logging must never break the primary search flow.
      this.logger.error(`Failed to persist search audit record: ${(err as Error).message}`);
      return undefined as unknown as SearchAuditEntity;
    }
  }

  async findRecentByVin(vin: string, limit = 20): Promise<SearchAuditEntity[]> {
    return this.repo.find({
      where: { vin },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
