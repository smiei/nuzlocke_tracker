-- CreateTable
CREATE TABLE "SoulLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ALIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "routeId" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CAUGHT',
    "isStatic" BOOLEAN NOT NULL DEFAULT false,
    "soulLinkId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_soulLinkId_fkey" FOREIGN KEY ("soulLinkId") REFERENCES "SoulLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SoulLink_routeId_key" ON "SoulLink"("routeId");

-- CreateIndex
CREATE INDEX "Encounter_familyId_idx" ON "Encounter"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_routeId_player_key" ON "Encounter"("routeId", "player");
