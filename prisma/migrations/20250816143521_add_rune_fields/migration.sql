-- AlterTable
ALTER TABLE "CharacterResources" ADD COLUMN     "runeCapacityBase" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "runeCapacityBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "runeRegenAddSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "runeRegenBaseSeconds" INTEGER NOT NULL DEFAULT 1800,
ADD COLUMN     "runeRegenMultiplier" INTEGER NOT NULL DEFAULT 1000;
