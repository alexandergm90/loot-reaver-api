import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { TopbarService } from './topbar.service';
import { AuthenticatedRequest } from '@/types/auth.types';

@Controller('topbar')
export class TopbarController {
  constructor(private readonly topbar: TopbarService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async get(@Req() req: AuthenticatedRequest) {
    const data = await this.topbar.getTopbarData(req.user.id);
    return data ?? {};
  }
}


