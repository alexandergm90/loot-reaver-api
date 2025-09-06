-- Add code field to Dungeon table with a default value
ALTER TABLE "Dungeon" ADD COLUMN "code" TEXT DEFAULT 'temp_code';

-- Update existing dungeons with proper codes
UPDATE "Dungeon" SET "code" = 'dungeon_' || "id" WHERE "code" = 'temp_code';

-- Make code field NOT NULL after setting values
ALTER TABLE "Dungeon" ALTER COLUMN "code" SET NOT NULL;

-- Remove the default value since it's no longer needed
ALTER TABLE "Dungeon" ALTER COLUMN "code" DROP DEFAULT;

-- Create unique index for code field
CREATE UNIQUE INDEX "Dungeon_code_key" ON "Dungeon"("code");
