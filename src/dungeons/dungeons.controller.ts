import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DungeonsService } from './dungeons.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { DungeonResponseDto } from './dto/dungeon-response.dto';
import { DungeonDetailsResponseDto } from './dto/dungeon-details.dto';
import { DungeonDetailsQueryDto } from './dto/dungeon-details-query.dto';

@Controller('dungeons')
@UseGuards(JwtAuthGuard)
export class DungeonsController {
  constructor(private readonly dungeonsService: DungeonsService) {}

  @Get()
  async getDungeons(@Request() req): Promise<DungeonResponseDto[]> {
    const characterId = req.user.characterId;
    return this.dungeonsService.getDungeons(characterId);
  }

  @Get(':id/details')
  async getDungeonDetails(
    @Param('id') dungeonId: string,
    @Query() query: DungeonDetailsQueryDto,
    @Request() req,
  ): Promise<DungeonDetailsResponseDto> {
    const characterId = req.user.characterId;
    return this.dungeonsService.getDungeonDetails(
      dungeonId,
      query.level,
      characterId,
    );
  }
}


