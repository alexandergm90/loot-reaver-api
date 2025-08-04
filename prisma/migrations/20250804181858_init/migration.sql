-- CreateEnum
CREATE TYPE "ItemSlot" AS ENUM ('helmet', 'chest', 'glove', 'feet', 'weapon', 'shield', 'cape', 'ring', 'neck');

-- CreateEnum
CREATE TYPE "ItemRarity" AS ENUM ('common', 'uncommon', 'rare', 'epic', 'legendary');

-- CreateEnum
CREATE TYPE "CharacterTrait" AS ENUM ('warrior', 'scholar', 'scoundrel');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3),
    "bannedUntil" TIMESTAMP(3),
    "isTester" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "region" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProvider" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "lootScore" INTEGER NOT NULL DEFAULT 0,
    "hasCharacter" BOOLEAN NOT NULL DEFAULT false,
    "trait" "CharacterTrait" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAppearance" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL,
    "hair" TEXT NOT NULL,
    "hairColor" TEXT NOT NULL,
    "eyes" TEXT NOT NULL,
    "mouth" TEXT NOT NULL,
    "beard" TEXT,
    "markings" TEXT,

    CONSTRAINT "CharacterAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "ItemRarity" NOT NULL,
    "slot" "ItemSlot" NOT NULL,
    "baseStats" JSONB NOT NULL,
    "iconUrl" TEXT NOT NULL,

    CONSTRAINT "ItemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterItem" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "slot" "ItemSlot" NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "durability" INTEGER NOT NULL DEFAULT 100,
    "socketedRunes" JSONB,
    "bonuses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterResources" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "scrap" INTEGER NOT NULL DEFAULT 0,
    "soulstones" INTEGER NOT NULL DEFAULT 0,
    "pvpTokens" INTEGER NOT NULL DEFAULT 0,
    "mirrorShards" INTEGER NOT NULL DEFAULT 0,
    "runes" INTEGER NOT NULL DEFAULT 0,
    "runesUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soulstonesUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pvpUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterResources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterStats" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "enemiesKilled" INTEGER NOT NULL DEFAULT 0,
    "playersFought" INTEGER NOT NULL DEFAULT 0,
    "resourcesGained" INTEGER NOT NULL DEFAULT 0,
    "questsCompleted" INTEGER NOT NULL DEFAULT 0,
    "dungeonRuns" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CharacterStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAchievement" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3),

    CONSTRAINT "CharacterAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goal" INTEGER NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthProvider_provider_providerId_key" ON "AuthProvider"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterAppearance_characterId_key" ON "CharacterAppearance"("characterId");

-- CreateIndex
CREATE INDEX "CharacterAppearance_characterId_idx" ON "CharacterAppearance"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemTemplate_code_key" ON "ItemTemplate"("code");

-- CreateIndex
CREATE INDEX "CharacterItem_characterId_idx" ON "CharacterItem"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterResources_characterId_key" ON "CharacterResources"("characterId");

-- CreateIndex
CREATE INDEX "CharacterResources_characterId_idx" ON "CharacterResources"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterStats_characterId_key" ON "CharacterStats"("characterId");

-- CreateIndex
CREATE INDEX "CharacterStats_characterId_idx" ON "CharacterStats"("characterId");

-- CreateIndex
CREATE INDEX "CharacterAchievement_characterId_idx" ON "CharacterAchievement"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- AddForeignKey
ALTER TABLE "AuthProvider" ADD CONSTRAINT "AuthProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAppearance" ADD CONSTRAINT "CharacterAppearance_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterItem" ADD CONSTRAINT "CharacterItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterResources" ADD CONSTRAINT "CharacterResources_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterStats" ADD CONSTRAINT "CharacterStats_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAchievement" ADD CONSTRAINT "CharacterAchievement_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
