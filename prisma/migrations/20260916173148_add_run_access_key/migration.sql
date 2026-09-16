-- Existing runs get a random key here: 16 bytes from SQLite's own CSPRNG,
-- hex-encoded. New runs get Prisma's nanoid() default instead - both are
-- opaque strings of at least 128 bits, nothing depends on their shape.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Run" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accessKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SOULLINK',
    "playerCount" INTEGER NOT NULL DEFAULT 2,
    "gameId" TEXT NOT NULL DEFAULT 'firered',
    "rulesMarkdown" TEXT NOT NULL DEFAULT '',
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Run" ("accessKey", "createdAt", "gameId", "id", "mode", "name", "playerCount", "rulesMarkdown", "settingsJson") SELECT lower(hex(randomblob(16))), "createdAt", "gameId", "id", "mode", "name", "playerCount", "rulesMarkdown", "settingsJson" FROM "Run";
DROP TABLE "Run";
ALTER TABLE "new_Run" RENAME TO "Run";
CREATE UNIQUE INDEX "Run_accessKey_key" ON "Run"("accessKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
