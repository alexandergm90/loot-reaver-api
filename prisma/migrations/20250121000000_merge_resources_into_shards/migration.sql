-- Add new shards column
ALTER TABLE "CharacterResources" ADD COLUMN "shards" INTEGER NOT NULL DEFAULT 0;

-- Drop old columns
ALTER TABLE "CharacterResources" DROP COLUMN "scrap";
ALTER TABLE "CharacterResources" DROP COLUMN "soulstones";
ALTER TABLE "CharacterResources" DROP COLUMN "mirrorShards";
ALTER TABLE "CharacterResources" DROP COLUMN "soulstonesUpdatedAt";

