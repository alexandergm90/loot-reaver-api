import { Controller, Get, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { DungeonsService } from './dungeons.service';
import { CombatService } from './combat.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { DungeonListDto } from './dto/dungeon-list.dto';
import { DungeonDetailsResponseDto } from './dto/dungeon-details.dto';
import { DungeonDetailsQueryDto } from './dto/dungeon-details-query.dto';
import { CombatResultDto } from './dto/combat-response.dto';

@Controller('dungeons')
@UseGuards(JwtAuthGuard)
export class DungeonsController {
  constructor(
    private readonly dungeonsService: DungeonsService,
    private readonly combatService: CombatService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getDungeons(@Request() req): Promise<DungeonListDto[]> {
    const characterId = await this.getCharacterId(req.user.id);
    return this.dungeonsService.getDungeons(characterId);
  }

  @Get(':id/details')
  async getDungeonDetails(
    @Param('id') dungeonId: string,
    @Query() query: DungeonDetailsQueryDto,
    @Request() req,
  ): Promise<DungeonDetailsResponseDto> {
    const characterId = await this.getCharacterId(req.user.id);
    return this.dungeonsService.getDungeonDetails(
      dungeonId,
      query.level,
      characterId,
    );
  }

  @Get(':id/run/:level')
  async runDungeon(
    @Param('id') dungeonId: string,
    @Param('level') level: number,
    @Request() req,
  ): Promise<CombatResultDto> {
    const characterId = await this.getCharacterId(req.user.id);
    return this.combatService.runCombat(dungeonId, level, characterId);
  }

  private async getCharacterId(userId: string): Promise<string> {
    const character = await this.prisma.character.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!character) {
      throw new NotFoundException('Character not found');
    }

    return character.id;
  }
}


