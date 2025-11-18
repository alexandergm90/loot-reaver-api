-- Replace ItemRarity enum with new custom values
-- Step 1: Create new enum type with new values
CREATE TYPE "ItemRarity_new" AS ENUM ('Worn', 'Superior', 'Enchanted', 'Heroic', 'Relic', 'Celestial');

-- Step 2: Add temporary column with new enum type
ALTER TABLE "CharacterItem" ADD COLUMN "rarity_new" "ItemRarity_new";

-- Step 3: Migrate existing data (map old values to new)
UPDATE "CharacterItem" SET "rarity_new" = CASE
  WHEN "rarity" = 'common' THEN 'Worn'::"ItemRarity_new"
  WHEN "rarity" = 'uncommon' THEN 'Superior'::"ItemRarity_new"
  WHEN "rarity" = 'rare' THEN 'Enchanted'::"ItemRarity_new"
  WHEN "rarity" = 'epic' THEN 'Heroic'::"ItemRarity_new"
  WHEN "rarity" = 'legendary' THEN 'Relic'::"ItemRarity_new"
  WHEN "rarity" = 'mythical' THEN 'Celestial'::"ItemRarity_new"
  ELSE 'Superior'::"ItemRarity_new"  -- Default fallback
END;

-- Step 4: Make the new column NOT NULL (after data migration)
ALTER TABLE "CharacterItem" ALTER COLUMN "rarity_new" SET NOT NULL;
ALTER TABLE "CharacterItem" ALTER COLUMN "rarity_new" SET DEFAULT 'Superior'::"ItemRarity_new";

-- Step 5: Drop the old column
ALTER TABLE "CharacterItem" DROP COLUMN "rarity";

-- Step 6: Rename the new column to the original name
ALTER TABLE "CharacterItem" RENAME COLUMN "rarity_new" TO "rarity";

-- Step 7: Drop the old enum type (only if no other tables use it)
-- First, check if any other tables reference ItemRarity - if so, update them too
DROP TYPE "ItemRarity";

-- Step 8: Rename the new enum type to the original name
ALTER TYPE "ItemRarity_new" RENAME TO "ItemRarity";

