-- currentPokemonId tracks the post-evolution form shown in the Links tab,
-- separate from pokemonId (what was actually caught, shown in the Tracker
-- tab). Existing rows haven't evolved yet, so backfill it to match pokemonId.
ALTER TABLE "Encounter" ADD COLUMN "currentPokemonId" INTEGER NOT NULL DEFAULT 0;
UPDATE "Encounter" SET "currentPokemonId" = "pokemonId";
