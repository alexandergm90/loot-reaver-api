-- AlterTable: Add isTwoHanded to ItemTemplate
ALTER TABLE "ItemTemplate" ADD COLUMN "isTwoHanded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add isTwoHanded and equippedHand to CharacterItem
ALTER TABLE "CharacterItem" ADD COLUMN "isTwoHanded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CharacterItem" ADD COLUMN "equippedHand" TEXT;

-- Update existing CharacterItem records to copy isTwoHanded from template
UPDATE "CharacterItem" 
SET "isTwoHanded" = (
  SELECT "isTwoHanded" 
  FROM "ItemTemplate" 
  WHERE "ItemTemplate"."id" = "CharacterItem"."templateId"
);

