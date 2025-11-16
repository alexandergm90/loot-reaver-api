import { PrismaClient, ItemRarity, ItemSlot } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed enemies
  const enemies = [
    {
      code: 'goblin_warrior',
      name: 'Goblin Warrior',
      hp: 50,
      atk: 12,
    },
    {
      code: 'goblin_archer',
      name: 'Goblin Archer',
      hp: 35,
      atk: 15,
    },
    {
      code: 'orc_brute',
      name: 'Orc Brute',
      hp: 80,
      atk: 20,
    },
    {
      code: 'skeleton_warrior',
      name: 'Skeleton Warrior',
      hp: 60,
      atk: 18,
    },
    {
      code: 'dark_mage',
      name: 'Dark Mage',
      hp: 40,
      atk: 25,
    },
  ];

  console.log('🌱 Seeding enemies...');
  for (const enemy of enemies) {
    const exists = await prisma.enemy.findUnique({ where: { code: enemy.code } });
    if (!exists) {
      await prisma.enemy.create({
        data: {
          code: enemy.code,
          name: enemy.name,
          hp: enemy.hp,
          atk: enemy.atk,
        },
      });
      console.log(`✔ Seeded enemy: ${enemy.name}`);
    } else {
      console.log(`⏩ Skipped existing enemy: ${enemy.name}`);
    }
  }

  // Get enemy IDs for dungeon composition
  const goblinWarrior = await prisma.enemy.findUnique({ where: { code: 'goblin_warrior' } });
  const goblinArcher = await prisma.enemy.findUnique({ where: { code: 'goblin_archer' } });
  const orcBrute = await prisma.enemy.findUnique({ where: { code: 'orc_brute' } });
  const skeletonWarrior = await prisma.enemy.findUnique({ where: { code: 'skeleton_warrior' } });
  const darkMage = await prisma.enemy.findUnique({ where: { code: 'dark_mage' } });

  // Seed dungeons
  const dungeons = [
    {
      name: 'Goblin Cave',
      code: 'goblin_cave',
      wavesCount: 3,
      waveComp: [
        { enemies: [{ id: goblinWarrior!.id, count: 2 }] },
        { enemies: [{ id: goblinWarrior!.id, count: 1 }, { id: goblinArcher!.id, count: 1 }] },
        { enemies: [{ id: goblinWarrior!.id, count: 2 }, { id: goblinArcher!.id, count: 2 }] },
      ],
      scaling: {
        hpGrowth: 0.15,
        atkGrowth: 0.12,
        defGrowth: 0.08,
        lootGrowth: 0.20,
      },
      rewards: {
        baseGoldMin: 50,
        baseGoldMax: 100,
        baseXpMin: 25,
        baseXpMax: 50,
        dropsJson: {
          items: [
            { itemId: 'basic_sword', weight: 0.3 },
            { itemId: 'basic_chest', weight: 0.2 },
          ],
        },
      },
    },
    {
      name: 'Dark Sanctuary',
      code: 'dark_sanctuary',
      wavesCount: 4,
      waveComp: [
        { enemies: [{ id: orcBrute!.id, count: 1 }] },
        { enemies: [{ id: orcBrute!.id, count: 2 }] },
        { enemies: [{ id: orcBrute!.id, count: 1 }, { id: goblinArcher!.id, count: 2 }] },
        { enemies: [{ id: orcBrute!.id, count: 3 }, { id: goblinArcher!.id, count: 1 }] },
      ],
      scaling: {
        hpGrowth: 0.18,
        atkGrowth: 0.15,
        defGrowth: 0.10,
        lootGrowth: 0.25,
      },
      rewards: {
        baseGoldMin: 100,
        baseGoldMax: 200,
        baseXpMin: 50,
        baseXpMax: 100,
        dropsJson: {
          items: [
            { itemId: 'basic_sword', weight: 0.4 },
            { itemId: 'basic_chest', weight: 0.3 },
            { itemId: 'basic_glove', weight: 0.2 },
          ],
        },
      },
    },
    {
      name: 'Undead Crypt',
      code: 'undead_crypt',
      wavesCount: 5,
      waveComp: [
        { enemies: [{ id: skeletonWarrior!.id, count: 1 }] },
        { enemies: [{ id: skeletonWarrior!.id, count: 2 }] },
        { enemies: [{ id: skeletonWarrior!.id, count: 1 }, { id: darkMage!.id, count: 1 }] },
        { enemies: [{ id: skeletonWarrior!.id, count: 2 }, { id: darkMage!.id, count: 1 }] },
        { enemies: [{ id: skeletonWarrior!.id, count: 3 }, { id: darkMage!.id, count: 2 }] },
      ],
      scaling: {
        hpGrowth: 0.20,
        atkGrowth: 0.18,
        defGrowth: 0.12,
        lootGrowth: 0.30,
      },
      rewards: {
        baseGoldMin: 150,
        baseGoldMax: 300,
        baseXpMin: 75,
        baseXpMax: 150,
        dropsJson: {
          items: [
            { itemId: 'basic_sword', weight: 0.3 },
            { itemId: 'basic_chest', weight: 0.3 },
            { itemId: 'basic_glove', weight: 0.2 },
            { itemId: 'basic_feet', weight: 0.2 },
          ],
        },
      },
    },
  ];

  console.log('🏰 Seeding dungeons...');
  for (const dungeonData of dungeons) {
    const exists = await prisma.dungeon.findFirst({ where: { name: dungeonData.name } });
    if (!exists) {
      const dungeon = await prisma.dungeon.create({
        data: {
          name: dungeonData.name,
          code: dungeonData.code,
          wavesCount: dungeonData.wavesCount,
          waveComp: dungeonData.waveComp,
        },
      });

      // Create scaling
      await prisma.dungeonScaling.create({
        data: {
          dungeonId: dungeon.id,
          hpGrowth: dungeonData.scaling.hpGrowth,
          atkGrowth: dungeonData.scaling.atkGrowth,
          defGrowth: dungeonData.scaling.defGrowth,
          lootGrowth: dungeonData.scaling.lootGrowth,
        },
      });

      // Create rewards
      await prisma.dungeonReward.create({
        data: {
          dungeonId: dungeon.id,
          baseGoldMin: dungeonData.rewards.baseGoldMin,
          baseGoldMax: dungeonData.rewards.baseGoldMax,
          baseXpMin: dungeonData.rewards.baseXpMin,
          baseXpMax: dungeonData.rewards.baseXpMax,
          dropsJson: dungeonData.rewards.dropsJson,
        },
      });

      console.log(`✔ Seeded dungeon: ${dungeonData.name}`);
    } else {
      console.log(`⏩ Skipped existing dungeon: ${dungeonData.name}`);
    }
  }

  const starterItems = [
    {
      code: 'basic_sword',
      name: 'Basic Sword',
      rarity: ItemRarity.common,
      slot: ItemSlot.weapon,
      baseStats: {
        attackType: "slashes",
        damage: 5,
        critChance: 0.01,
        element: 'physical',
      },
    },
    {
      code: 'leather_tunic',
      name: 'Leather Tunic',
      rarity: ItemRarity.common,
      slot: ItemSlot.chest,
      baseStats: {
        armor: 3,
      },
    },
    {
      code: 'basic_cape',
      name: 'Basic Cape',
      rarity: ItemRarity.common,
      slot: ItemSlot.cape,
      baseStats: {
        armor: 1,
      },
    },
    {
      code: 'leather_boot',
      name: 'Leather Boots',
      rarity: ItemRarity.common,
      slot: ItemSlot.feet,
      baseStats: {
        armor: 2,
      },
    },
    {
      code: 'leather_glove',
      name: 'Leather Gloves',
      rarity: ItemRarity.common,
      slot: ItemSlot.glove,
      baseStats: {
        armor: 1,
        agility: 1,
      },
    },
    {
      code: 'leather_helmet',
      name: 'Leather Helmet',
      rarity: ItemRarity.common,
      slot: ItemSlot.helmet,
      baseStats: {
        armor: 2,
      },
    },
    {
      code: 'leather_pants',
      name: 'Leather Pants',
      rarity: ItemRarity.common,
      slot: ItemSlot.legs,
      baseStats: {
        armor: 2,
      },
    },
  ];

  for (const item of starterItems) {
    const iconUrl = `/images/items/${item.slot}/${item.code}.png`;

    const exists = await prisma.itemTemplate.findUnique({ where: { code: item.code } });
    if (!exists) {
      await prisma.itemTemplate.create({
        data: {
          code: item.code,
          name: item.name,
          rarity: item.rarity,
          slot: item.slot,
          baseStats: item.baseStats,
          iconUrl, // auto-generated
        },
      });
      console.log(`✔ Seeded item: ${item.name}`);
    } else {
      console.log(`⏩ Skipped existing item: ${item.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void (async () => {
      await prisma.$disconnect();
    })();
  });
