import { redirect } from "next/navigation";
import {
  getEffectiveness,
  getEvolutions,
  getGameOrDefault,
  getMoves,
  getMoveTypeHistory,
  getMoveset,
  getPokemonList,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { PokedexTable } from "@/components/PokedexTable";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";

// Run-scoped: the Pokédex reflects the current run's game (dex scope, sprites,
// generation, and the game's evolution methods for the detail card).
export const dynamic = "force-dynamic";

export default async function PokedexPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/pokedex?run=${runId}`);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const pokemon = getPokemonList(game.dexLimit);
  const evolutions = getEvolutions({
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
  });
  // Evolution families already used in this run (Species Clause) - for the
  // Pokédex availability filter.
  const encounters = await prisma.encounter.findMany({
    where: { runId },
    select: { familyId: true },
  });
  const lockedFamilyIds = [...new Set(encounters.map((e) => e.familyId))];

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <PokemonDetailProvider
        pokemonList={pokemon}
        evolutions={evolutions}
        moveData={{ movesets: getMoveset(game.versionGroup), moves: getMoves(lang) }}
        moveTypeHistory={getMoveTypeHistory()}
        effectiveness={getEffectiveness(game.generation)}
        generation={game.generation}
        dexLimit={game.dexLimit}
        lang={lang}
      >
        <div>
          <h2 className="mb-4 text-xl font-semibold">{translations[lang].pokedex.heading}</h2>
          <PokedexTable pokemon={pokemon} lockedFamilyIds={lockedFamilyIds} />
        </div>
      </PokemonDetailProvider>
    </SpriteSetProvider>
  );
}
