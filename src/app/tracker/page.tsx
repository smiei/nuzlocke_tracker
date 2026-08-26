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
  const { runId, mode, gameId, settings } = await resolveRunId(run);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const routes = await getRoutesForRun(runId, gameId);
  const pokemonList = getPokemonList(game.dexLimit, game.generation);
  const encounters = await prisma.encounter.findMany({ where: { runId } });

  return (
    <BlindflugProvider on={settings.blindflug}>
    <div>
      <CanonicalRun runId={runId} />
      <SpriteSetProvider spriteSet={game.spriteSet}>
        <PlayerNamesProvider names={settings.playerNames} lang={lang}>
          <PokemonDetailProvider
            pokemonList={pokemonList}
            forms={getPokemonForms(game.dexLimit, game.generation)}
            evolutions={getEvolutions({
              gameId,
              impossible: settings.evolutionOverridesImpossible,
              easier: settings.evolutionOverridesEasier,
              timeBased: settings.evolutionOverridesTimeBased,
            })}
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
            <TrackerView
              runId={runId}
              mode={mode}
              lang={lang}
              settings={settings}
              routes={routes}
              pokemonList={pokemonList}
              encounters={encounters}
            />
          </PokemonDetailProvider>
        </PlayerNamesProvider>
      </SpriteSetProvider>
    </div>
    </BlindflugProvider>
  );
}
