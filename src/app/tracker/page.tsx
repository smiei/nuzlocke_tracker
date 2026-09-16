import { getEvolutions, getGameOrDefault, getMoveTypeHistory, getMoveset } from "@/lib/data";
import {
  getEffectivenessForGame,
  getPokemonListForGame,
  getPokemonFormsForGame,
  getMovesForGame,
  getDataGenerationForGame,
  getFusionSpriteConfigForGame,
} from "@/lib/gameData";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { boundRouteMap } from "@/lib/speciesClause";
import { getRoutesForRun } from "@/lib/runRoutes";
import { getLang } from "@/lib/i18n/getLang";
import { TrackerView } from "@/components/TrackerView";
import { CanonicalRun } from "@/components/CanonicalRun";
import { BlindflugProvider } from "@/components/BlindflugProvider";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";

// Shared, constantly-mutated state (two players editing concurrently) - never
// serve a build-time snapshot, always hit the DB fresh.
export const dynamic = "force-dynamic";

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, runKey, players, gameId, settings } = await resolveRunId(run);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const routes = await getRoutesForRun(runId, gameId);
  const pokemonList = getPokemonListForGame(game);
  const encounters = await prisma.encounter.findMany({ where: { runId } });
  const boundRoutes = [
    ...boundRouteMap(
      await prisma.soulLink.findMany({ where: { runId }, select: { id: true, routeId: true, boundToId: true } }),
    ),
  ];

  return (
    <BlindflugProvider on={settings.blindflug}>
    <div>
      <CanonicalRun runKey={runKey} />
      <SpriteSetProvider spriteSet={game.spriteSet} fusion={getFusionSpriteConfigForGame(game)}>
        <PlayerNamesProvider names={settings.playerNames} lang={lang}>
          <PokemonDetailProvider
            pokemonList={pokemonList}
            forms={getPokemonFormsForGame(game)}
            evolutions={getEvolutions({
              gameId,
              impossible: settings.evolutionOverridesImpossible,
              easier: settings.evolutionOverridesEasier,
              timeBased: settings.evolutionOverridesTimeBased,
            })}
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
            <TrackerView
              runKey={runKey}
              players={players}
              boundRoutes={boundRoutes}
              lang={lang}
              settings={settings}
              routes={routes}
              pokemonList={pokemonList}
              encounters={encounters}
              fusionEnabled={Boolean(game.fusion)}
            />
          </PokemonDetailProvider>
        </PlayerNamesProvider>
      </SpriteSetProvider>
    </div>
    </BlindflugProvider>
  );
}
