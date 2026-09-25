import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchAuditEntity } from './entities/search-audit.entity';
import { SearchAuditService } from './search-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([SearchAuditEntity])],
  providers: [SearchAuditService],
  exports: [SearchAuditService],
})
export class PersistenceModule {}
