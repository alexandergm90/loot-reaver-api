-- Convert ItemRarity enum values to lowercase
-- Step 1: Create new enum type with lowercase values
CREATE TYPE "ItemRarity_new" AS ENUM ('worn', 'superior', 'enchanted', 'heroic', 'relic', 'celestial');

-- Step 2: Add temporary column with new enum type
ALTER TABLE "CharacterItem" ADD COLUMN "rarity_new" "ItemRarity_new";

-- Step 3: Migrate existing data (map uppercase to lowercase)
UPDATE "CharacterItem" SET "rarity_new" = CASE
  WHEN "rarity" = 'Worn' THEN 'worn'::"ItemRarity_new"
  WHEN "rarity" = 'Superior' THEN 'superior'::"ItemRarity_new"
  WHEN "rarity" = 'Enchanted' THEN 'enchanted'::"ItemRarity_new"
  WHEN "rarity" = 'Heroic' THEN 'heroic'::"ItemRarity_new"
  WHEN "rarity" = 'Relic' THEN 'relic'::"ItemRarity_new"
  WHEN "rarity" = 'Celestial' THEN 'celestial'::"ItemRarity_new"
  ELSE 'superior'::"ItemRarity_new"  -- Default fallback
END;

-- Step 4: Make the new column NOT NULL (after data migration)
ALTER TABLE "CharacterItem" ALTER COLUMN "rarity_new" SET NOT NULL;
ALTER TABLE "CharacterItem" ALTER COLUMN "rarity_new" SET DEFAULT 'superior'::"ItemRarity_new";

-- Step 5: Drop the old column
ALTER TABLE "CharacterItem" DROP COLUMN "rarity";

-- Step 6: Rename the new column to the original name
ALTER TABLE "CharacterItem" RENAME COLUMN "rarity_new" TO "rarity";

-- Step 7: Drop the old enum type
DROP TYPE "ItemRarity";

-- Step 8: Rename the new enum type to the original name
ALTER TYPE "ItemRarity_new" RENAME TO "ItemRarity";

