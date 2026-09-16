-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Run" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SOULLINK',
    "playerCount" INTEGER NOT NULL DEFAULT 2,
    "gameId" TEXT NOT NULL DEFAULT 'firered',
    "rulesMarkdown" TEXT NOT NULL DEFAULT '',
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Run" ("createdAt", "gameId", "id", "mode", "name", "rulesMarkdown", "settingsJson") SELECT "createdAt", "gameId", "id", "mode", "name", "rulesMarkdown", "settingsJson" FROM "Run";
DROP TABLE "Run";
ALTER TABLE "new_Run" RENAME TO "Run";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
