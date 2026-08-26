import {
  getEffectiveness,
  getEvolutions,
  getGameOrDefault,
  getMoves,
  getMoveTypeHistory,
  getMoveset,
  getPokemonList,
  getPokemonForms,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { PokedexTable } from "@/components/PokedexTable";
import { CanonicalRun } from "@/components/CanonicalRun";
import { BlindflugProvider } from "@/components/BlindflugProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PageHeader } from "@/components/ui/Page";

// Run-scoped: the Pokédex reflects the current run's game (dex scope, sprites,
// generation, and the game's evolution methods for the detail card).
export const dynamic = "force-dynamic";

export default async function PokedexPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, gameId, settings } = await resolveRunId(run);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const pokemon = getPokemonList(game.dexLimit, game.generation);
  const evolutions = getEvolutions({
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
    timeBased: settings.evolutionOverridesTimeBased,
  });
  // Evolution families already used in this run (Species Clause) - for the
  // Pokédex availability filter.
  const encounters = await prisma.encounter.findMany({
    where: { runId },
    select: { familyId: true },
  });
  const lockedFamilyIds = [...new Set(encounters.map((e) => e.familyId))];

  return (
    <BlindflugProvider on={settings.blindflug}>
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <CanonicalRun runId={runId} />
      <PokemonDetailProvider
        pokemonList={pokemon}
        forms={getPokemonForms(game.dexLimit, game.generation)}
        evolutions={evolutions}
        moveData={{
          movesets: getMoveset(game.versionGroup),
          moves: getMoves(lang, game.generation),
        }}
        moveTypeHistory={getMoveTypeHistory()}
        effectiveness={getEffectiveness(game.generation)}
        generation={game.generation}
        dexLimit={game.dexLimit}
        lang={lang}
      >
        <div>
          <PageHeader title={translations[lang].pokedex.heading} />
          <PokedexTable pokemon={pokemon} lockedFamilyIds={lockedFamilyIds} />
        </div>
      </PokemonDetailProvider>
    </SpriteSetProvider>
    </BlindflugProvider>
  );
}
