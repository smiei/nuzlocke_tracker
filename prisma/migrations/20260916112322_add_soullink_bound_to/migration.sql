-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SoulLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ALIVE',
    "teamPosition" INTEGER,
    "deathPlayer" TEXT,
    "deathCause" TEXT,
    "deathLevelCapId" INTEGER,
    "diedAt" DATETIME,
    "boundToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SoulLink_boundToId_fkey" FOREIGN KEY ("boundToId") REFERENCES "SoulLink" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SoulLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SoulLink" ("createdAt", "deathCause", "deathLevelCapId", "deathPlayer", "diedAt", "id", "routeId", "runId", "status", "teamPosition", "updatedAt") SELECT "createdAt", "deathCause", "deathLevelCapId", "deathPlayer", "diedAt", "id", "routeId", "runId", "status", "teamPosition", "updatedAt" FROM "SoulLink";
DROP TABLE "SoulLink";
ALTER TABLE "new_SoulLink" RENAME TO "SoulLink";
CREATE UNIQUE INDEX "SoulLink_runId_routeId_key" ON "SoulLink"("runId", "routeId");
CREATE UNIQUE INDEX "SoulLink_runId_teamPosition_key" ON "SoulLink"("runId", "teamPosition");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
