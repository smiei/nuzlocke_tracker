-- CreateTable
CREATE TABLE "RulePreset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "rulesMarkdown" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RulePreset_name_key" ON "RulePreset"("name");
