-- Run.mode: fixed at creation ("SoulLink" = two-player duo, "Classic" = solo).
-- All existing runs were always played as SoulLink duos.
ALTER TABLE "Run" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'SOULLINK';
