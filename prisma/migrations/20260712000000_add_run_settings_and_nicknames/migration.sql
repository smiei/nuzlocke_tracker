-- Per-run rule toggles (JSON object, parsed with defaults in code) and
-- optional per-encounter nicknames. Plain ADD COLUMNs - no table rebuild.
ALTER TABLE "Run" ADD COLUMN "settingsJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Encounter" ADD COLUMN "nickname" TEXT;
