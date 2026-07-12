-- Per-run game data pack (data/games/<gameId>/). All existing runs were
-- FireRed/LeafGreen, so the default backfills them correctly.
ALTER TABLE "Run" ADD COLUMN "gameId" TEXT NOT NULL DEFAULT 'firered';
