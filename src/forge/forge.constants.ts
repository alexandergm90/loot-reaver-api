import { ItemRarity } from '@prisma/client';

export const MAX_LEVEL = 10;

// Flat stat growth multipliers per rarity (percentage per level)
export const flatGrowthByRarity: Record<ItemRarity, number> = {
  worn: 0.02,       // +2% per level
  superior: 0.03,   // +3%
  enchanted: 0.04,  // +4%
  heroic: 0.06,     // +6%
  relic: 0.08,      // +8%
  celestial: 0.1,   // +10%
};

// Chance stat linear growth per rarity (absolute value per level)
export const chanceGrowthByRarity: Record<ItemRarity, number> = {
  worn: 0.0005,      // +0.05% per level
  superior: 0.0008,  // +0.08% per level
  enchanted: 0.001,   // +0.1% per level
  heroic: 0.0015,    // +0.15% per level
  relic: 0.002,      // +0.2% per level
  celestial: 0.003,  // +0.3% per level
};

// Upgrade cost multipliers by rarity
export const rarityFactor: Record<ItemRarity, number> = {
  worn: 1.0,
  superior: 1.5,
  enchanted: 2.5,
  heroic: 4.0,
  relic: 6.5,
  celestial: 10.0,
};

// Base upgrade cost constant
export const BASE_UPGRADE_COST = 10;

// Scrap reward constants
export const SCRAP_GOLD_PER_POWER = 0.5;
export const SCRAP_REFUND_MULTIPLIER = 0.8; // 80% refund

// Rarity upgrade chance base values (percentage)
export const baseRarityUpgradeChance: Record<ItemRarity, number> = {
  worn: 0.12,        // 12% base chance
  superior: 0.10,    // 10%
  enchanted: 0.08,    // 8%
  heroic: 0.06,      // 6%
  relic: 0.04,       // 4%
  celestial: 0.0,    // Cannot upgrade beyond celestial
};

// Shard boost constants
export const SHARD_BOOST_PER_SHARD = 0.01; // +1% per shard
export const MAX_SHARD_BOOST = 0.10; // Max +10% boost (capped to prevent P2W)

