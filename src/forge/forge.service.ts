import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ItemRarity } from '@prisma/client';
import {
  MAX_LEVEL,
  flatGrowthByRarity,
  chanceGrowthByRarity,
  rarityFactor,
  BASE_UPGRADE_COST,
  SCRAP_GOLD_PER_POWER,
  SCRAP_REFUND_MULTIPLIER,
  baseRarityUpgradeChance,
  SHARD_BOOST_PER_SHARD,
  MAX_SHARD_BOOST,
} from './forge.constants';
import { ForgePreviewResponseDto } from './dto/forge-preview-response.dto';

@Injectable()
export class ForgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreview(userId: string, itemId: string): Promise<ForgePreviewResponseDto> {
    // Fetch item with template and character ownership validation
    const item = await this.prisma.characterItem.findFirst({
      where: { id: itemId },
      include: {
        template: true,
        character: {
          select: {
            id: true,
            userId: true,
            resources: {
              select: {
                shards: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    if (item.character.userId !== userId) {
      throw new ForbiddenException('Cannot view item you do not own');
    }

    const level = item.level || 1;
    const rarity = item.rarity;
    const nextLevel = level + 1;
    const canUpgrade = level < MAX_LEVEL;

    // Extract current stats from bonuses JSON
    const currentStats = this.extractStatsFromBonuses(item.bonuses, item.template.baseStats as any);

    // Calculate upgrade cost: BASE * rarityFactor[rarity] * (nextLevel)²
    const upgradeCost = canUpgrade
      ? Math.floor(BASE_UPGRADE_COST * rarityFactor[rarity] * nextLevel * nextLevel)
      : 0;

    // Calculate scrap reward: itemPower * SCRAP_GOLD_PER_POWER * SCRAP_REFUND_MULTIPLIER
    const scrapReward = Math.floor(
      item.power * SCRAP_GOLD_PER_POWER * SCRAP_REFUND_MULTIPLIER,
    );

    // Calculate predicted stats for next level
    const nextLevelStats = canUpgrade
      ? this.calculateNextLevelStats(currentStats, rarity)
      : { ...currentStats };

    // Calculate rarity upgrade chances
    const baseRarityChance = this.calculateRarityUpgradeChance(rarity, level);
    const shards = item.character.resources?.shards || 0;
    const shardBoost = Math.min(shards * SHARD_BOOST_PER_SHARD, MAX_SHARD_BOOST);
    const rarityUpgradeChanceWithShards = Math.min(baseRarityChance + shardBoost, 1.0);

    return {
      itemId: item.id,
      name: item.template.name,
      rarity: rarity,
      level: level,
      maxLevel: MAX_LEVEL,
      itemPower: item.power,
      gold: {
        upgradeCost,
        scrapReward,
      },
      stats: {
        current: this.roundStatsForDisplay(currentStats),
        nextLevel: this.roundStatsForDisplay(nextLevelStats),
      },
      forge: {
        canUpgrade,
        rarityUpgradeChance: baseRarityChance,
        rarityUpgradeChanceWithShards: rarityUpgradeChanceWithShards,
      },
    };
  }

  /**
   * Extract stats from bonuses JSON structure
   * Combines template baseStats with item bonuses
   */
  private extractStatsFromBonuses(bonuses: any, baseStats: any): Record<string, number> {
    const stats: Record<string, number> = {};

    // Start with baseStats from template
    if (baseStats) {
      // Handle weapon damage (can be single value or range)
      if (baseStats.damage !== undefined) {
        stats.attack = baseStats.damage;
      } else if (baseStats.damageMin !== undefined && baseStats.damageMax !== undefined) {
        stats.attack = (baseStats.damageMin + baseStats.damageMax) / 2;
      }

      // Primary stats from baseStats
      if (baseStats.armor !== undefined) {
        stats.armor = baseStats.armor;
      }
      if (baseStats.health !== undefined) {
        stats.health = baseStats.health;
      }

      // Crit chance from baseStats
      if (baseStats.critChance !== undefined) {
        stats.critChance = baseStats.critChance;
      }
    }

    // Add bonuses on top of baseStats
    if (bonuses) {
      const primary = bonuses.primary || {};
      const attributes = bonuses.attributes || {};
      const elementPower = bonuses.elementPower || {};
      const special = bonuses.special || {};

      // Primary stats (additive to baseStats)
      if (primary.health !== undefined) {
        stats.health = (stats.health || 0) + primary.health;
      }
      if (primary.armor !== undefined) {
        stats.armor = (stats.armor || 0) + primary.armor;
      }

      // Attributes
      stats.strength = attributes.strength || 0;
      stats.dexterity = attributes.dexterity || 0;
      stats.intelligence = attributes.intelligence || 0;

      // Elemental stats
      stats.fireFlat = elementPower.fire || 0;
      stats.lightningFlat = elementPower.lightning || 0;
      stats.poisonFlat = elementPower.poison || 0;

      // Special/chance stats (additive to baseStats)
      if (special.critChance !== undefined) {
        stats.critChance = (stats.critChance || 0) + special.critChance;
      }
      if (special.critDamage !== undefined) {
        stats.critDamage = special.critDamage;
      }
      if (special.dodgeChance !== undefined) {
        stats.dodgeChance = special.dodgeChance;
      }
      if (special.blockChance !== undefined) {
        stats.blockChance = special.blockChance;
      }
    }

    return stats;
  }

  /**
   * Calculate predicted stats for next level
   * Flat stats: currentInternal * (1 + flatGrowth[rarity])
   * Chance stats: currentChance + growthChance[rarity]
   */
  private calculateNextLevelStats(
    currentStats: Record<string, number>,
    rarity: ItemRarity,
  ): Record<string, number> {
    const nextStats: Record<string, number> = { ...currentStats };

    const flatGrowth = flatGrowthByRarity[rarity];
    const chanceGrowth = chanceGrowthByRarity[rarity];

    // Flat stats that grow multiplicatively
    const flatStatKeys = [
      'health',
      'armor',
      'strength',
      'dexterity',
      'intelligence',
      'fireFlat',
      'lightningFlat',
      'poisonFlat',
      'attack',
    ];

    // Chance stats that grow linearly
    const chanceStatKeys = ['critChance', 'critDamage', 'dodgeChance', 'blockChance'];

    for (const key of flatStatKeys) {
      if (nextStats[key] !== undefined && nextStats[key] > 0) {
        nextStats[key] = nextStats[key] * (1 + flatGrowth);
      }
    }

    for (const key of chanceStatKeys) {
      if (nextStats[key] !== undefined) {
        nextStats[key] = nextStats[key] + chanceGrowth;
      }
    }

    return nextStats;
  }

  /**
   * Calculate base rarity upgrade chance
   */
  private calculateRarityUpgradeChance(rarity: ItemRarity, level: number): number {
    // If already at max rarity, no upgrade possible
    if (rarity === 'celestial') {
      return 0.0;
    }

    const baseChance = baseRarityUpgradeChance[rarity];
    // Slightly decrease chance as level increases (optional tuning)
    const levelPenalty = level * 0.001; // -0.1% per level

    return Math.max(0, baseChance - levelPenalty);
  }

  /**
   * Round stats for display
   * Flat stats: floor
   * Chance stats: keep decimal precision (2-3 decimal places)
   */
  private roundStatsForDisplay(stats: Record<string, number>): Record<string, number> {
    const rounded: Record<string, number> = {};

    const chanceStatKeys = ['critChance', 'critDamage', 'dodgeChance', 'blockChance'];

    for (const [key, value] of Object.entries(stats)) {
      if (chanceStatKeys.includes(key)) {
        // Round to 4 decimal places for chances (e.g., 0.0508)
        rounded[key] = Math.round(value * 10000) / 10000;
      } else {
        // Floor for flat stats
        rounded[key] = Math.floor(value);
      }
    }

    return rounded;
  }
}

