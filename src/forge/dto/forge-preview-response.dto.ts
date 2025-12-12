import { ItemRarity } from '@prisma/client';

export class ForgePreviewResponseDto {
  itemId: string;
  name: string;
  rarity: ItemRarity;
  level: number;
  maxLevel: number;
  itemPower: number;

  gold: {
    upgradeCost: number;
    scrapReward: number;
  };

  stats: {
    current: Record<string, number>;
    nextLevel: Record<string, number>;
  };

  forge: {
    canUpgrade: boolean;
    rarityUpgradeChance: number;
    rarityUpgradeChanceWithShards: number;
  };
}

