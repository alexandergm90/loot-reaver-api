-- AlterTable: Add rarity column to CharacterItem with default 'uncommon'
ALTER TABLE "CharacterItem" ADD COLUMN "rarity" "ItemRarity" NOT NULL DEFAULT 'uncommon';

-- AlterTable: Remove rarity column from ItemTemplate
ALTER TABLE "ItemTemplate" DROP COLUMN "rarity";






