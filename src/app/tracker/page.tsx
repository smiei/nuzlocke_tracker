import { redirect } from "next/navigation";
import {
  getEffectiveness,
  getEvolutions,
  getGameOrDefault,
  getMoves,
  getMoveTypeHistory,
  getMoveset,
  getRoutes,
  getPokemonList,
  getPokemonForms,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getEncounterDrafts } from "@/lib/draftStore";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { TrackerView } from "@/components/TrackerView";
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
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/tracker?run=${runId}`);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const routes = getRoutes(gameId);
  const pokemonList = getPokemonList(game.dexLimit);
  const encounters = await prisma.encounter.findMany({ where: { runId } });
  const drafts = getEncounterDrafts(runId);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{translations[lang].tracker.heading}</h2>
      <SpriteSetProvider spriteSet={game.spriteSet}>
        <PlayerNamesProvider names={settings.playerNames} lang={lang}>
          <PokemonDetailProvider
            pokemonList={pokemonList}
            forms={getPokemonForms(game.dexLimit)}
            evolutions={getEvolutions({
              gameId,
              impossible: settings.evolutionOverridesImpossible,
              easier: settings.evolutionOverridesEasier,
            })}
            moveData={{ movesets: getMoveset(game.versionGroup), moves: getMoves(lang) }}
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
              drafts={drafts}
            />
          </PokemonDetailProvider>
        </PlayerNamesProvider>
      </SpriteSetProvider>
    </div>
  );
}
