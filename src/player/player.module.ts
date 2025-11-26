import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { StatsModule } from '@/common/stats/stats.module';
import { TopbarService } from './topbar.service';
import { TopbarController } from './topbar.controller';
import { CharacterService } from './character.service';
import { CharacterController } from './character.controller';

@Module({
  imports: [PrismaModule, StatsModule],
  providers: [TopbarService, CharacterService],
  controllers: [TopbarController, CharacterController],
})
export class PlayerModule {}


