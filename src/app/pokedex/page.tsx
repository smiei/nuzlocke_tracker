import { getEvolutions, getGameOrDefault, getMoveTypeHistory, getMoveset } from "@/lib/data";
import {
  getEffectivenessForGame,
  getMovesForGame,
  getPokemonListForGame,
  getPokemonFormsForGame,
  getDataGenerationForGame,
  getFusionSpriteConfigForGame,
} from "@/lib/gameData";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { boundRouteMap, clauseView } from "@/lib/speciesClause";
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
  const { runId, runKey, players, gameId, settings } = await resolveRunId(run);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const pokemon = getPokemonListForGame(game);
  const evolutions = getEvolutions({
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
    timeBased: settings.evolutionOverridesTimeBased,
  });
  // Evolution families the Species Clause has used up (src/lib/speciesClause.ts),
  // for the availability filter. The Pokédex belongs to no player, so a family
  // only counts once no player may catch it any more.
  const lockedFamilyIds = [
    ...clauseView(await prisma.encounter.findMany({ where: { runId } }), {
      rules: settings,
      players,
      boundRouteOf: boundRouteMap(
        await prisma.soulLink.findMany({ where: { runId }, select: { id: true, routeId: true, boundToId: true } }),
      ),
    }).lockedForAll(),
  ];

  return (
    <BlindflugProvider on={settings.blindflug}>
    <SpriteSetProvider spriteSet={game.spriteSet} fusion={getFusionSpriteConfigForGame(game)}>
      <CanonicalRun runKey={runKey} />
      <PokemonDetailProvider
        pokemonList={pokemon}
        forms={getPokemonFormsForGame(game)}
        evolutions={evolutions}
        moveData={{
          movesets: getMoveset(game.versionGroup),
          moves: getMovesForGame(game, lang),
        }}
        moveTypeHistory={getMoveTypeHistory()}
        effectiveness={getEffectivenessForGame(game)}
        generation={getDataGenerationForGame(game)}
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
