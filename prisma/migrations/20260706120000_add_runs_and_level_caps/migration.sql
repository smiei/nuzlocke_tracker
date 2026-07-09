-- Runs table + the default run that all existing data gets backfilled into.
CREATE TABLE "Run" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "Run" ("id", "name") VALUES (1, 'Run 1');

PRAGMA foreign_keys=OFF;

-- Rebuild SoulLink: add runId (backfilled to 1), rescope unique constraint, add FK.
CREATE TABLE "new_SoulLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ALIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SoulLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SoulLink" ("id","runId","routeId","status","createdAt","updatedAt")
  SELECT "id", 1, "routeId", "status", "createdAt", "updatedAt" FROM "SoulLink";
DROP TABLE "SoulLink";
ALTER TABLE "new_SoulLink" RENAME TO "SoulLink";
CREATE UNIQUE INDEX "SoulLink_runId_routeId_key" ON "SoulLink"("runId", "routeId");

-- Rebuild Encounter: same treatment, plus keep the existing soulLinkId FK.
CREATE TABLE "new_Encounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CAUGHT',
    "isStatic" BOOLEAN NOT NULL DEFAULT false,
    "soulLinkId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Encounter_soulLinkId_fkey" FOREIGN KEY ("soulLinkId") REFERENCES "SoulLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Encounter" ("id","runId","routeId","player","pokemonId","familyId","status","isStatic","soulLinkId","createdAt","updatedAt")
  SELECT "id", 1, "routeId","player","pokemonId","familyId","status","isStatic","soulLinkId","createdAt","updatedAt" FROM "Encounter";
DROP TABLE "Encounter";
ALTER TABLE "new_Encounter" RENAME TO "Encounter";
CREATE INDEX "Encounter_runId_familyId_idx" ON "Encounter"("runId", "familyId");
CREATE UNIQUE INDEX "Encounter_runId_routeId_player_key" ON "Encounter"("runId","routeId","player");

PRAGMA foreign_keys=ON;

-- New, empty per-run level-cap-progress table.
CREATE TABLE "LevelCapProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "levelCapId" INTEGER NOT NULL,
    "defeated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LevelCapProgress_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LevelCapProgress_runId_levelCapId_key" ON "LevelCapProgress"("runId","levelCapId");
