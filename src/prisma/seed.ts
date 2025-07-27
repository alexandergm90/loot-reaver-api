import { PrismaClient, ItemRarity, ItemSlot } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const starterItems = [
    {
      code: 'basic_sword',
      name: 'Worn Blade',
      rarity: ItemRarity.common,
      slot: ItemSlot.weapon,
      baseStats: {
        damage: 5,
        critChance: 0.01,
        element: 'physical',
      },
    },
    {
      code: 'basic_chest',
      name: 'Torn Tunic',
      rarity: ItemRarity.common,
      slot: ItemSlot.chest,
      baseStats: {
        armor: 3,
      },
    },
    {
      code: 'basic_glove',
      name: 'Frayed Gloves',
      rarity: ItemRarity.common,
      slot: ItemSlot.glove,
      baseStats: {
        armor: 1,
        agility: 1,
      },
    },
    {
      code: 'basic_feet',
      name: 'Worn Boots',
      rarity: ItemRarity.common,
      slot: ItemSlot.feet,
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
