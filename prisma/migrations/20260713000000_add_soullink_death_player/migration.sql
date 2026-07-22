-- Which player lost their Pokémon when a SoulLink died (SoulLink mode only).
-- Plain ADD COLUMN, nullable - no table rebuild.
ALTER TABLE "SoulLink" ADD COLUMN "deathPlayer" TEXT;
