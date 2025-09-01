-- CreateTable
CREATE TABLE "Enemy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "hp" INTEGER NOT NULL,
    "atk" INTEGER NOT NULL,

    CONSTRAINT "Enemy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dungeon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wavesCount" INTEGER NOT NULL,
    "waveComp" JSONB NOT NULL,

    CONSTRAINT "Dungeon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonScaling" (
    "id" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "hpGrowth" DOUBLE PRECISION NOT NULL,
    "atkGrowth" DOUBLE PRECISION NOT NULL,
    "defGrowth" DOUBLE PRECISION NOT NULL,
    "lootGrowth" DOUBLE PRECISION,

    CONSTRAINT "DungeonScaling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonReward" (
    "id" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "baseGoldMin" INTEGER NOT NULL,
    "baseGoldMax" INTEGER NOT NULL,
    "baseXpMin" INTEGER NOT NULL,
    "baseXpMax" INTEGER NOT NULL,
    "dropsJson" JSONB,

    CONSTRAINT "DungeonReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonRun" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "turns" INTEGER NOT NULL,
    "rewardsJson" JSONB NOT NULL,
    "logCompactJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DungeonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerDungeonProgress" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "dungeonId" TEXT NOT NULL,
    "highestLevelCleared" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerDungeonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enemy_code_key" ON "Enemy"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonScaling_dungeonId_key" ON "DungeonScaling"("dungeonId");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonReward_dungeonId_key" ON "DungeonReward"("dungeonId");

-- CreateIndex
CREATE INDEX "DungeonRun_characterId_idx" ON "DungeonRun"("characterId");

-- CreateIndex
CREATE INDEX "DungeonRun_dungeonId_idx" ON "DungeonRun"("dungeonId");

-- CreateIndex
CREATE INDEX "PlayerDungeonProgress_characterId_idx" ON "PlayerDungeonProgress"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerDungeonProgress_characterId_dungeonId_key" ON "PlayerDungeonProgress"("characterId", "dungeonId");

-- AddForeignKey
ALTER TABLE "DungeonScaling" ADD CONSTRAINT "DungeonScaling_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonReward" ADD CONSTRAINT "DungeonReward_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDungeonProgress" ADD CONSTRAINT "PlayerDungeonProgress_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerDungeonProgress" ADD CONSTRAINT "PlayerDungeonProgress_dungeonId_fkey" FOREIGN KEY ("dungeonId") REFERENCES "Dungeon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
