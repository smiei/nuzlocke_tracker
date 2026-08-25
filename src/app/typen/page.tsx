import {
  getCatchRates,
  getEffectiveness,
  getEvolutions,
  getGameOrDefault,
  getLearnset,
  getMoves,
  getMoveTypeHistory,
  getMoveset,
  getPokemonById,
  getPokemonList,
  getPokemonForms,
  getRoutes,
} from "@/lib/data";
import { getTypesForGeneration } from "@/lib/effectiveness";
import { explosiveMove } from "@/lib/learnset";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { routeName } from "@/lib/i18n/localize";
import { displayNameWithForm, movepoolId } from "@/lib/forms";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { TeamMember } from "@/components/TeamWeaknessesView";
import { CanonicalRun } from "@/components/CanonicalRun";
import type { OpenSlot } from "@/components/CatchRateView";
import { AnalyzeView } from "@/components/AnalyzeView";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";

// Run-scoped: the combined Kampf & Fang tab uses the run's game (type chart,
// dex, sprites, catch mechanics, level-up movesets) and its current team for
// the battle matchup / the quick-catch dropdowns.
export const dynamic = "force-dynamic";

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings } = await resolveRunId(run);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const learnsetTable = getLearnset(game.versionGroup);
  const pokemonList = getPokemonList(game.dexLimit, game.generation);
  // Formes are pickable HERE (unlike in the Pokédex or an encounter): scouting
  // a Wash Rotom or a Deoxys Attack is exactly what this tab is for. Species-
  // keyed tables (catch rates, learnsets, explosiveMap) are looked up via
  // baseSpeciesId, so a forme inherits its species' values.
  const formEntries = getPokemonForms(game.dexLimit, game.generation);
  const pickableList = [...pokemonList, ...formEntries];
  const moveset = getMoveset(game.versionGroup);
  const moves = getMoves(lang, game.generation);

  const catchRates = Object.fromEntries(
    getCatchRates(game.generation).map((entry) => [entry.id, entry.catch_rate]),
  );

  const encounters = await prisma.encounter.findMany({ where: { runId } });

  // Families already used by ANY encounter in this run are locked by the
  // Species Clause - the calculator only warns, never blocks. Clause off -> no
  // marks at all.
  const lockedFamilyIds = settings.speciesClause
    ? [...new Set(encounters.map((e) => e.familyId))]
    : [];

  // Open (route, player) slots for the quick-catch dropdown: pairs without an
  // encounter yet. Statics honor the run's "statics" rule; Classic lists only
  // Player 1.
  const routes = getRoutes(gameId).filter((r) => settings.statics || r.type === "route");
  const players = mode === RunMode.CLASSIC ? [Player.PLAYER1] : [Player.PLAYER1, Player.PLAYER2];
  const openSlots: OpenSlot[] = [];
  for (const player of players) {
    for (const route of routes) {
      const taken = encounters.some((e) => e.routeId === route.id && e.player === player);
      if (!taken) openSlots.push({ routeId: route.id, player, routeName: routeName(route, lang) });
    }
  }

  // Precompute which obtainable Pokémon can go boom (self-destruct/explosion)
  // so the Trainer view can warn about the selected opponent.
  const explosiveMap: Record<number, { name: string; level: number }> = {};
  for (const p of pokemonList) {
    const boom = explosiveMove(moveset, moves, p.id, lang);
    if (boom) explosiveMap[p.id] = { name: boom.name, level: boom.level };
  }

  // Current team per player for the battle matchup.
  // A pair only forms when BOTH players catch: a route with a Fled/Killed
  // encounter never produced a link, so its surviving catch is boxed and must
  // not show up as a team member here either (the Team tab hides it too).
  const failedRouteIds =
    mode === RunMode.SOULLINK
      ? new Set(
          (
            await prisma.encounter.findMany({
              where: {
                runId,
                status: { in: [EncounterStatus.FLED, EncounterStatus.KILLED] },
              },
              select: { routeId: true },
            })
          ).map((e) => e.routeId),
        )
      : new Set<number>();
  const teamLinks = (
    await prisma.soulLink.findMany({
      where: { runId, teamPosition: { not: null }, status: LinkStatus.ALIVE },
      include: { encounters: true },
      orderBy: { teamPosition: "asc" },
    })
  ).filter((link) => !failedRouteIds.has(link.routeId));
  const byPlayer = new Map<Player, TeamMember[]>([
    [Player.PLAYER1, []],
    [Player.PLAYER2, []],
  ]);
  for (const link of teamLinks) {
    for (const e of link.encounters) {
      const pokemon = getPokemonById(e.currentPokemonId, game.generation);
      if (!pokemon) continue;
      byPlayer.get(e.player)?.push({
        encounterId: e.id,
        pokemonId: e.currentPokemonId,
        speciesId: movepoolId(pokemon, (id) => learnsetTable[String(id)] !== undefined),
        name: displayNameWithForm(pokemon, lang),
        types: pokemon.types,
      });
    }
  }
  const teams =
    mode === RunMode.CLASSIC
      ? [{ player: Player.PLAYER1, members: byPlayer.get(Player.PLAYER1) ?? [] }]
      : [
          { player: Player.PLAYER1, members: byPlayer.get(Player.PLAYER1) ?? [] },
          { player: Player.PLAYER2, members: byPlayer.get(Player.PLAYER2) ?? [] },
        ];

  const effectiveness = getEffectiveness(game.generation);
  const attackTypes = getTypesForGeneration(game.generation);

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <CanonicalRun runId={runId} />
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <PokemonDetailProvider
          pokemonList={pokemonList}
          forms={formEntries}
          evolutions={getEvolutions({
            gameId,
            impossible: settings.evolutionOverridesImpossible,
            easier: settings.evolutionOverridesEasier,
            timeBased: settings.evolutionOverridesTimeBased,
          })}
          moveData={{ movesets: moveset, moves }}
          moveTypeHistory={getMoveTypeHistory()}
          effectiveness={effectiveness}
          generation={game.generation}
          dexLimit={game.dexLimit}
          lang={lang}
        >
          <AnalyzeView
            runId={runId}
            mode={mode}
            pokemonList={pickableList}
            generation={game.generation}
            versionGroup={game.versionGroup}
            effectiveness={effectiveness}
            attackTypes={attackTypes}
            catchRates={catchRates}
            lockedFamilyIds={lockedFamilyIds}
            openSlots={openSlots}
            learnset={learnsetTable}
            teams={teams}
            explosiveMap={explosiveMap}
            settings={settings}
          />
        </PokemonDetailProvider>
      </PlayerNamesProvider>
    </SpriteSetProvider>
  );
}
