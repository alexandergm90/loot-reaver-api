import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { DungeonListDto } from './dto/dungeon-list.dto';
import { DungeonDetailsResponseDto } from './dto/dungeon-details.dto';

@Injectable()
export class DungeonsService {
  constructor(private prisma: PrismaService) {}

  async getDungeons(characterId: string): Promise<DungeonListDto[]> {
    const dungeons = await this.prisma.dungeon.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        progress: {
          where: {
            characterId: characterId,
          },
          select: {
            highestLevelCleared: true,
          },
        },
      },
    });

    return dungeons.map((dungeon) => ({
      id: dungeon.id,
      name: dungeon.name,
      code: dungeon.code,
      highestLevelCleared: dungeon.progress[0]?.highestLevelCleared || 0,
      availableLevels: (dungeon.progress[0]?.highestLevelCleared || 0) + 1,
    }));
  }

  async getDungeonDetails(
    dungeonId: string,
    level: number,
    characterId: string,
  ): Promise<DungeonDetailsResponseDto> {
    const dungeon = await this.prisma.dungeon.findUnique({
      where: { id: dungeonId },
      include: {
        scaling: true,
        rewards: true,
        progress: {
          where: {
            characterId: characterId,
          },
        },
      },
    });

    if (!dungeon) {
      throw new NotFoundException('Dungeon not found');
    }

    // Check if player can access this level
    const highestLevelCleared = dungeon.progress[0]?.highestLevelCleared || 0;
    if (level > highestLevelCleared + 1) {
      throw new NotFoundException('Level not available');
    }

    // Get all enemy IDs from wave composition
    const waveComp = dungeon.waveComp as any[];
    const enemyIds = new Set<string>();
    waveComp.forEach((wave) => {
      wave.enemies.forEach((enemyRef: any) => {
        enemyIds.add(enemyRef.id);
      });
    });

    // Fetch enemy data
    const enemies = await this.prisma.enemy.findMany({
      where: {
        id: {
          in: Array.from(enemyIds),
        },
      },
    });

    // Create enemy lookup map
    const enemyMap = new Map(enemies.map((enemy) => [enemy.id, enemy]));

    // Calculate scaled stats for each enemy
    const scaling = dungeon.scaling;
    const scaledWaves = waveComp.map((wave) => ({
      enemies: wave.enemies.map((enemyRef: any) => {
        const enemy = enemyMap.get(enemyRef.id);
        if (!enemy) {
          throw new Error(`Enemy with id ${enemyRef.id} not found`);
        }

        const scaledHp = Math.floor(enemy.hp * (1 + (scaling?.hpGrowth || 0) * level));
        const scaledAtk = Math.floor(enemy.atk * (1 + (scaling?.atkGrowth || 0) * level));
        const scaledDef = Math.floor(0 * (1 + (scaling?.defGrowth || 0) * level)); // Assuming base def is 0

        return {
          enemy: {
            id: enemy.id,
            name: enemy.name,
            code: enemy.code,
            baseHp: enemy.hp,
            baseAtk: enemy.atk,
            scaledHp,
            scaledAtk,
            scaledDef,
          },
          count: enemyRef.count,
        };
      }),
    }));

    // Calculate scaled rewards
    const rewards = dungeon.rewards;
    if (!rewards) {
      throw new Error('Dungeon rewards not found');
    }
    
    const lootGrowth = scaling?.lootGrowth || 0;
    const scaledRewards = {
      goldMin: Math.floor(rewards.baseGoldMin * (1 + lootGrowth * level)),
      goldMax: Math.floor(rewards.baseGoldMax * (1 + lootGrowth * level)),
      xpMin: Math.floor(rewards.baseXpMin * (1 + lootGrowth * level)),
      xpMax: Math.floor(rewards.baseXpMax * (1 + lootGrowth * level)),
      dropsJson: rewards.dropsJson,
    };

    return {
      id: dungeon.id,
      name: dungeon.name,
      level,
      waves: scaledWaves,
      rewards: scaledRewards,
      requiredItemPower: level * 10, // Simple formula for now
    };
  }
}

