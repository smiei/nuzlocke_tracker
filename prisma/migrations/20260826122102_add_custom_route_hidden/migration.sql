-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomRoute" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runId" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'route',
    "afterRouteId" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomRoute_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CustomRoute" ("afterRouteId", "createdAt", "id", "name", "routeId", "runId", "type") SELECT "afterRouteId", "createdAt", "id", "name", "routeId", "runId", "type" FROM "CustomRoute";
DROP TABLE "CustomRoute";
ALTER TABLE "new_CustomRoute" RENAME TO "CustomRoute";
CREATE UNIQUE INDEX "CustomRoute_runId_routeId_key" ON "CustomRoute"("runId", "routeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
