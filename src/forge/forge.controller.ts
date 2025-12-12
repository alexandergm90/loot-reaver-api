import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthenticatedRequest } from '@/types/auth.types';
import { ForgeService } from './forge.service';
import { ForgePreviewQueryDto } from './dto/forge-preview-query.dto';
import { ForgePreviewResponseDto } from './dto/forge-preview-response.dto';

@Controller('forge')
@UseGuards(JwtAuthGuard)
export class ForgeController {
  constructor(private readonly forgeService: ForgeService) {}

  @Get('preview')
  async getPreview(
    @Req() req: AuthenticatedRequest,
    @Query() query: ForgePreviewQueryDto,
  ): Promise<ForgePreviewResponseDto> {
    return this.forgeService.getPreview(req.user.id, query.itemId);
  }
}

