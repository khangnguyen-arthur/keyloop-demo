import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MetricsService } from './metrics.service';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class CommonModule {}
