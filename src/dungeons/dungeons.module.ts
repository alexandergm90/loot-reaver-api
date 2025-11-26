import { Module } from '@nestjs/common';
import { DungeonsController } from './dungeons.controller';
import { DungeonsService } from './dungeons.service';
import { CombatService } from './combat.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { StatsModule } from '@/common/stats/stats.module';

@Module({
  imports: [PrismaModule, StatsModule],
  controllers: [DungeonsController],
  providers: [DungeonsService, CombatService],
  exports: [DungeonsService, CombatService],
})
export class DungeonsModule {}

