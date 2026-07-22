-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Encounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "currentPokemonId" INTEGER NOT NULL,
    "familyId" INTEGER NOT NULL,
    "nickname" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CAUGHT',
    "isStatic" BOOLEAN NOT NULL DEFAULT false,
    "shiny" BOOLEAN NOT NULL DEFAULT false,
    "soulLinkId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Encounter_soulLinkId_fkey" FOREIGN KEY ("soulLinkId") REFERENCES "SoulLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Encounter" ("createdAt", "currentPokemonId", "familyId", "id", "isStatic", "nickname", "player", "pokemonId", "routeId", "runId", "soulLinkId", "status", "updatedAt") SELECT "createdAt", "currentPokemonId", "familyId", "id", "isStatic", "nickname", "player", "pokemonId", "routeId", "runId", "soulLinkId", "status", "updatedAt" FROM "Encounter";
DROP TABLE "Encounter";
ALTER TABLE "new_Encounter" RENAME TO "Encounter";
CREATE INDEX "Encounter_runId_familyId_idx" ON "Encounter"("runId", "familyId");
CREATE UNIQUE INDEX "Encounter_runId_routeId_player_key" ON "Encounter"("runId", "routeId", "player");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
