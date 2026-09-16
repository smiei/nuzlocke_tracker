import {
  getEvolutionById,
  getEvolutions,
  getGameOrDefault,
  getLearnset,
  getMoveTypeHistory,
  getMoveset,
} from "@/lib/data";
import {
  getCatchRatesForGame,
  getEffectivenessForGame,
  getPokemonByIdForGame,
  getPokemonListForGame,
  getPokemonFormsForGame,
  getMovesForGame,
  getAttackTypesForGame,
  getDataGenerationForGame,
  getFusionSpriteConfigForGame,
  isInDex,
} from "@/lib/gameData";
import { explosiveMove } from "@/lib/learnset";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getRoutesForRun } from "@/lib/runRoutes";
import { getLang } from "@/lib/i18n/getLang";
import { routeName } from "@/lib/i18n/localize";
import { movepoolId } from "@/lib/forms";
import { resolveEncounterMon } from "@/lib/encounterMon";
import { formedLinks, groupTeamPositions, isFoldedDonor } from "@/lib/fusionGroups";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { TeamMember } from "@/components/TeamWeaknessesView";
import { CanonicalRun } from "@/components/CanonicalRun";
import { BlindflugProvider } from "@/components/BlindflugProvider";
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
  const pokemonList = getPokemonListForGame(game);
  // Formes are pickable HERE (unlike in the Pokédex or an encounter): scouting
  // a Wash Rotom or a Deoxys Attack is exactly what this tab is for. Species-
  // keyed tables (catch rates, learnsets, explosiveMap) are looked up via
  // baseSpeciesId, so a forme inherits its species' values.
  const formEntries = getPokemonFormsForGame(game);
  const pickableList = [...pokemonList, ...formEntries];
  const moveset = getMoveset(game.versionGroup);
  const moves = getMovesForGame(game, lang);
  const evoOptions = {
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
    timeBased: settings.evolutionOverridesTimeBased,
  };

  const catchRates = Object.fromEntries(
    getCatchRatesForGame(game).map((entry) => [entry.id, entry.catch_rate]),
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
  const routes = (await getRoutesForRun(runId, gameId)).filter(
    (r) => !r.hidden && (settings.statics || r.type === "route"),
  );
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
          encounters
            .filter((e) => e.status === EncounterStatus.FLED || e.status === EncounterStatus.KILLED)
            .map((e) => e.routeId),
        )
      : new Set<number>();
  const aliveLinks = formedLinks(
    await prisma.soulLink.findMany({
      where: { runId, status: LinkStatus.ALIVE },
      include: { encounters: true },
    }),
    failedRouteIds,
  );
  // Infinite Fusion: "on the team" is asked of the fusion group, whose slot
  // can sit on either route's link; a donor is folded into its host, and a
  // host's name/types are the fused ones - see src/lib/fusionGroups.ts.
  // Without fusions every group is one link and this is its own teamPosition.
  const groupPositions = groupTeamPositions(aliveLinks);
  const teamLinks = aliveLinks
    .filter((link) => groupPositions.get(link.id) != null)
    .sort(
      (a, b) =>
        (groupPositions.get(a.id) ?? 0) - (groupPositions.get(b.id) ?? 0) ||
        (a.teamPosition ?? Number.MAX_SAFE_INTEGER) - (b.teamPosition ?? Number.MAX_SAFE_INTEGER),
    );
  const visibleEncounterIds = new Set(aliveLinks.flatMap((link) => link.encounters.map((e) => e.id)));
  const donorByHostId = new Map(
    encounters.filter((e) => e.fusedIntoId !== null).map((e) => [e.fusedIntoId as number, e]),
  );
  const encounterMonDeps = {
    pokemonById: (id: number) => getPokemonByIdForGame(game, id),
    evolvesTo: (id: number) => getEvolutionById(id, evoOptions)?.evolvesTo ?? [],
    inDex: (id: number) => isInDex(game, id),
    lang,
  };
  const movepoolOf = (pokemonId: number) => {
    const pokemon = getPokemonByIdForGame(game, pokemonId);
    return pokemon ? movepoolId(pokemon, (id) => learnsetTable[String(id)] !== undefined) : pokemonId;
  };
  const byPlayer = new Map<Player, TeamMember[]>([
    [Player.PLAYER1, []],
    [Player.PLAYER2, []],
  ]);
  for (const link of teamLinks) {
    for (const e of link.encounters) {
      if (isFoldedDonor(e, visibleEncounterIds)) continue;
      const mon = resolveEncounterMon(
        e.currentPokemonId,
        donorByHostId.get(e.id)?.currentPokemonId,
        encounterMonDeps,
      );
      if (!mon) continue;
      byPlayer.get(e.player)?.push({
        encounterId: e.id,
        pokemonId: e.currentPokemonId,
        speciesId: movepoolOf(e.currentPokemonId),
        name: mon.name,
        types: mon.types,
        bodyId: mon.bodyId,
        bodySpeciesId: mon.bodyId !== null ? movepoolOf(mon.bodyId) : null,
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

  const effectiveness = getEffectivenessForGame(game);
  const attackTypes = getAttackTypesForGame(game);

  return (
    <BlindflugProvider on={settings.blindflug}>
    <SpriteSetProvider spriteSet={game.spriteSet} fusion={getFusionSpriteConfigForGame(game)}>
      <CanonicalRun runId={runId} />
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <PokemonDetailProvider
          pokemonList={pokemonList}
          forms={formEntries}
          evolutions={getEvolutions(evoOptions)}
          moveData={{ movesets: moveset, moves }}
          moveTypeHistory={getMoveTypeHistory()}
          effectiveness={effectiveness}
          generation={getDataGenerationForGame(game)}
          dexLimit={game.dexLimit}
          lang={lang}
        >
          <AnalyzeView
            runId={runId}
            mode={mode}
            pokemonList={pickableList}
            // The real battle-mechanics generation (ball list, catch formula),
            // deliberately NOT dataGeneration - see CatchRateView's use of it.
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
            fusionEnabled={Boolean(game.fusion)}
          />
        </PokemonDetailProvider>
      </PlayerNamesProvider>
    </SpriteSetProvider>
    </BlindflugProvider>
  );
}
