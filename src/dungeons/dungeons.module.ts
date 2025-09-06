import { Module } from '@nestjs/common';
import { DungeonsController } from './dungeons.controller';
import { DungeonsService } from './dungeons.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DungeonsController],
  providers: [DungeonsService],
  exports: [DungeonsService],
})
export class DungeonsModule {}

