import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { TopbarService } from './topbar.service';
import { TopbarController } from './topbar.controller';

@Module({
  imports: [PrismaModule],
  providers: [TopbarService],
  controllers: [TopbarController],
})
export class PlayerModule {}


