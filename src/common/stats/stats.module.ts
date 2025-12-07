import { Module } from '@nestjs/common';
import { StatsCalculationService } from './stats-calculation.service';

@Module({
  providers: [StatsCalculationService],
  exports: [StatsCalculationService],
})
export class StatsModule {}






