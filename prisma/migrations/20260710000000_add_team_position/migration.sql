-- SoulLink.teamPosition: 0-5 when the link occupies one of the run's 6 team
-- slots, else NULL. Safe to add on populated tables: every existing row gets
-- NULL, and SQLite treats NULLs as distinct in a unique index, so the new
-- unique constraint never conflicts across the many unassigned links.
ALTER TABLE "SoulLink" ADD COLUMN "teamPosition" INTEGER;
CREATE UNIQUE INDEX "SoulLink_runId_teamPosition_key" ON "SoulLink"("runId", "teamPosition");
