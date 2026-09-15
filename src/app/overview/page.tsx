import {
  getEvolutionById,
  getEvolutions,
  getGameOrDefault,
  getLearnset,
  getLevelCaps,
  getMoveset,
  getMoveTypeHistory,
} from "@/lib/data";
import {
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
import { teamOffensiveCoverage } from "@/lib/effectiveness";
import { attackTypesAtLevel } from "@/lib/learnset";
import { resolveEncounterMon } from "@/lib/encounterMon";
import { groupSoulLinks, isFoldedDonor, teamLinkIds } from "@/lib/fusionGroups";
import { computeLevelCapProgress, computeRouteProgress, eliteFourIndex } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getRoutesForRun } from "@/lib/runRoutes";
import { getLang } from "@/lib/i18n/getLang";
import { localizeName, pokemonName, routeName } from "@/lib/i18n/localize";
import { movepoolId } from "@/lib/forms";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { CanonicalRun } from "@/components/CanonicalRun";
import { BlindflugProvider } from "@/components/BlindflugProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import {
  OverviewView,
  type OverviewBadge,
  type OverviewDeathTally,
  type OverviewMemorialEntry,
  type OverviewStats,
} from "@/components/OverviewView";
import type { TeamMember } from "@/components/TeamWeaknessesView";

export const dynamic = "force-dynamic";

const PLAYERS = [Player.PLAYER1, Player.PLAYER2] as const;
// Attack-type coverage below the first level cap (no cap defeated yet) is
// judged against a starter-level team, not an empty one.
const FALLBACK_LEVEL = 5;

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings } = await resolveRunId(run);
  const game = getGameOrDefault(gameId);
  const lang = await getLang();

  // A pair only forms if BOTH players catch. If a route has a Fled/Killed
  // encounter, the pair never formed - the surviving catch is boxed and any
  // "dead" mark on it must NOT count as a death or show in the Memorial
  // (mirrors what the Pokémon tab hides). Classic runs never hide anything.
  const failedRouteIds =
    mode === RunMode.SOULLINK
      ? new Set(
          (
            await prisma.encounter.findMany({
              where: { runId, status: { in: [EncounterStatus.FLED, EncounterStatus.KILLED] } },
              select: { routeId: true },
            })
          ).map((e) => e.routeId),
        )
      : new Set<number>();

  // Ordered by the route's position in routes.json, not by route id: ids are
  // frozen while the array order is the display order and gets reshuffled, so
  // sorting by id would list the Memorial in a stale order (see the same note
  // in links/page.tsx). Routes no longer in the pack sort last.
  const routes = await getRoutesForRun(runId, gameId);
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const routeOrder = new Map(routes.map((r, i) => [r.id, i]));
  const soulLinks = (
    await prisma.soulLink.findMany({
      where: { runId },
      include: { encounters: true },
    })
  )
    .filter((link) => !failedRouteIds.has(link.routeId))
    .sort(
      (a, b) =>
        (routeOrder.get(a.routeId) ?? Number.MAX_SAFE_INTEGER) -
        (routeOrder.get(b.routeId) ?? Number.MAX_SAFE_INTEGER),
    );
  // Unfiltered (any status, both players) - the route-progress bar counts a
  // route "done" once every player slot has an entry at all, same as the
  // Tracker tab, regardless of whether a pair ever formed.
  const allEncounters = await prisma.encounter.findMany({ where: { runId } });
  const capProgressRows = await prisma.levelCapProgress.findMany({ where: { runId } });
  const evoOptions = {
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
    timeBased: settings.evolutionOverridesTimeBased,
  };

  // Read before the team loop below: it decides whether a forme keeps its own
  // movepool or falls back to its species.
  const learnset = getLearnset(game.versionGroup);

  // Infinite Fusion: a fusion is two encounters, and its group's team slot can
  // sit on either route's link (see src/lib/fusionGroups.ts) - so "on the
  // team" is asked of the group, a donor is folded into its host, and a host's
  // name/types/BST are the fused ones. All of this is a no-op without fusions.
  const encounterMonDeps = {
    pokemonById: (id: number) => getPokemonByIdForGame(game, id),
    evolvesTo: (id: number) => getEvolutionById(id, evoOptions)?.evolvesTo ?? [],
    inDex: (id: number) => isInDex(game, id),
    lang,
  };
  const aliveLinks = soulLinks.filter((link) => link.status !== LinkStatus.DEAD);
  const onTeamLinkIds = teamLinkIds(aliveLinks);
  const visibleEncounterIds = new Set(soulLinks.flatMap((link) => link.encounters.map((e) => e.id)));
  const donorByHostId = new Map(
    allEncounters.filter((e) => e.fusedIntoId !== null).map((e) => [e.fusedIntoId as number, e]),
  );
  const movepoolOf = (pokemonId: number) => {
    const pokemon = getPokemonByIdForGame(game, pokemonId);
    // Formes with their own movepool keep it; the rest fall back.
    return pokemon ? movepoolId(pokemon, (id) => learnset[String(id)] !== undefined) : pokemonId;
  };

  // --- Team (alive + on a slot) per player: defensive + offensive coverage.
  const teamByPlayer = new Map<Player, TeamMember[]>(PLAYERS.map((p) => [p, []]));
  for (const link of aliveLinks) {
    if (!onTeamLinkIds.has(link.id)) continue;
    for (const e of link.encounters) {
      if (isFoldedDonor(e, visibleEncounterIds)) continue;
      const mon = resolveEncounterMon(
        e.currentPokemonId,
        donorByHostId.get(e.id)?.currentPokemonId,
        encounterMonDeps,
      );
      if (!mon) continue;
      teamByPlayer.get(e.player)?.push({
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
      ? [{ player: Player.PLAYER1, members: teamByPlayer.get(Player.PLAYER1) ?? [] }]
      : PLAYERS.map((p) => ({ player: p, members: teamByPlayer.get(p) ?? [] }));

  // Level caps: last earned cap + the next one (computed early - the
  // offensive-gap coverage below is judged against the team's current cap,
  // not their theoretical level-100 moveset).
  const defeatedIds = new Set(capProgressRows.filter((p) => p.defeated).map((p) => p.levelCapId));
  const levelCapItems = getLevelCaps(gameId).map((cap) => ({
    ...cap,
    defeated: defeatedIds.has(cap.id),
  }));
  const caps = levelCapItems.filter((c) => c.max_level !== null);
  const capCurrent = caps.filter((c) => defeatedIds.has(c.id)).at(-1)?.max_level ?? null;
  const capNext = caps.find((c) => !defeatedIds.has(c.id))?.max_level ?? null;

  // Progress bars (Encounter tab's + Journey tab's), mirrored at the top of
  // the Overview tab.
  const routeProgress = computeRouteProgress(
    routes,
    allEncounters,
    mode === RunMode.CLASSIC,
    settings.statics,
  );
  const levelCapProgress = computeLevelCapProgress(levelCapItems);
  const levelCapMarkerAt = eliteFourIndex(levelCapItems);

  // Gym badges: every level-cap entry that awards one, generation-specific
  // icon (data/badges.json + scripts/download-badges.mjs), earned ones shown
  // normally and the rest grayed out but still visible.
  const badges: OverviewBadge[] = levelCapItems
    .filter((c) => c.badge !== null)
    .map((c) => ({ id: c.id, badge: c.badge!, defeated: c.defeated }));

  // --- Offensive coverage gaps per player, at the team's current level cap
  // (a move only "counts" if the team could actually have it by now).
  const table = getEffectivenessForGame(game);
  const defenderTypes = getAttackTypesForGame(game);
  const coverageLevel = capCurrent ?? FALLBACK_LEVEL;
  const offensiveGaps = teams.map(({ player, members }) => {
    const atkTypes = new Set<string>();
    for (const m of members) {
      // A fusion can use what either component learns.
      for (const speciesId of [m.speciesId, m.bodySpeciesId ?? null]) {
        if (speciesId === null) continue;
        for (const a of attackTypesAtLevel(learnset, speciesId, coverageLevel)) atkTypes.add(a.type);
      }
    }
    return { player, gaps: teamOffensiveCoverage(table, [...atkTypes], defenderTypes).gaps };
  });

  // Display order of the Journey milestones, so the Memorial reads in the
  // order the run actually happened rather than by level-cap id.
  const capOrder = new Map(levelCapItems.map((cap, i) => [cap.id, i]));

  // --- Counts, team/bank BST, death tally and the memorial in one pass.
  const caught = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  const caused = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  const teamSummePlayer = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  const teamSummeMaxPlayer = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  const bankSummePlayer = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  const bankSummeMaxPlayer = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  let totalDeaths = 0;
  let unattributedDeaths = 0;
  let teamSumme = 0;
  let teamSummeMax = 0;
  const memorial: OverviewMemorialEntry[] = [];

  // Deaths and the Memorial count fusion GROUPS (see src/lib/fusionGroups.ts),
  // the unit markDead kills in one go and the Team tab shows as one dead card:
  // a dead fusion is one death with both players' fused Pokémon, not one entry
  // per route with the body listed as a Pokémon of its own. Without fusions
  // every group is one link - the old one-entry-per-link Memorial.
  const deadLinks = soulLinks.filter((link) => link.status === LinkStatus.DEAD);
  const deadLinkById = new Map(deadLinks.map((link) => [link.id, link]));
  const routeNameOf = (routeId: number) => {
    const route = routeById.get(routeId);
    return route ? routeName(route, lang) : `Route #${routeId}`;
  };
  for (const group of groupSoulLinks(
    deadLinks.map((link) => link.id),
    deadLinks.flatMap((link) => link.encounters),
  )) {
    const members = group.map((id) => deadLinkById.get(id)!);
    // markDead/setDeathPoint write the same death to every link of a group.
    const first = members[0];
    const groupEncounters = members.flatMap((link) => link.encounters);
    const groupEncounterIds = new Set(groupEncounters.map((e) => e.id));
    totalDeaths++;
    // Death-tally scoreboard: only pairs that actually formed (both
    // players caught) count, same as the Journey tab's version did.
    if (members.every((link) => link.encounters.length >= 2)) {
      if (first.deathPlayer) caused.set(first.deathPlayer, (caused.get(first.deathPlayer) ?? 0) + 1);
      else unattributedDeaths++;
    }
    memorial.push({
      soulLinkId: first.id,
      routeName: members.map((link) => routeNameOf(link.routeId)).join(" + "),
      // Player 1 above Player 2, then route order - same as the Team tab.
      pokemon: groupEncounters
        .filter((e) => !isFoldedDonor(e, groupEncounterIds))
        .sort(
          (a, b) =>
            (a.player === b.player ? 0 : a.player === Player.PLAYER1 ? -1 : 1) ||
            (routeOrder.get(a.routeId) ?? Number.MAX_SAFE_INTEGER) -
              (routeOrder.get(b.routeId) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((e) => {
          const donor = donorByHostId.get(e.id);
          const body = donor && groupEncounterIds.has(donor.id) ? donor : undefined;
          const head = getPokemonByIdForGame(game, e.currentPokemonId);
          const bodyPokemon = body ? getPokemonByIdForGame(game, body.currentPokemonId) : undefined;
          const species = head
            ? bodyPokemon
              ? `${pokemonName(head, lang)} / ${pokemonName(bodyPokemon, lang)}`
              : pokemonName(head, lang)
            : `#${e.currentPokemonId}`;
          const nick = settings.nicknames && e.nickname ? e.nickname : null;
          return {
            id: e.currentPokemonId,
            bodyId: body?.currentPokemonId ?? null,
            name: nick ?? species,
            species: nick ? species : null,
          };
        }),
      deathPlayer: first.deathPlayer,
      deathCause: first.deathCause,
      deathLevelCapId: first.deathLevelCapId,
      deathPointLabel:
        first.deathLevelCapId !== null
          ? (() => {
              const cap = levelCapItems.find((c) => c.id === first.deathLevelCapId);
              return cap ? `${localizeName(cap.names, lang)} · ${localizeName(cap.location, lang)}` : null;
            })()
          : null,
      // null = predates death-point tracking; those park at the top until
      // edited. A recorded death with no cap yet has diedAt set and sorts
      // ahead of every cap instead.
      recorded: first.diedAt !== null,
      sortIndex:
        first.diedAt === null
          ? -Infinity
          : first.deathLevelCapId === null
            ? -1
            : (capOrder.get(first.deathLevelCapId) ?? Number.MAX_SAFE_INTEGER),
      diedAt: first.diedAt?.getTime() ?? null,
    });
  }

  for (const link of soulLinks) {
    if (link.status === LinkStatus.DEAD) continue;
    for (const e of link.encounters) {
      if (e.status !== EncounterStatus.CAUGHT) continue;
      caught.set(e.player, (caught.get(e.player) ?? 0) + 1);
      // Infinite Fusion: a donor is represented by its host's fusion, not
      // independently - it counts towards neither team nor bank BST (it still
      // counts as "caught" above, which is a historical tally), and the host
      // counts with the fused BST.
      if (isFoldedDonor(e, visibleEncounterIds)) continue;
      const mon = resolveEncounterMon(
        e.currentPokemonId,
        donorByHostId.get(e.id)?.currentPokemonId,
        encounterMonDeps,
      );
      const summe = mon?.stats.Summe ?? 0;
      const summeMax = mon?.summeMax ?? 0;
      if (onTeamLinkIds.has(link.id)) {
        teamSumme += summe;
        teamSummeMax += summeMax;
        teamSummePlayer.set(e.player, (teamSummePlayer.get(e.player) ?? 0) + summe);
        teamSummeMaxPlayer.set(e.player, (teamSummeMaxPlayer.get(e.player) ?? 0) + summeMax);
      } else {
        // "Bank": caught, alive, but not on the 6-slot team.
        bankSummePlayer.set(e.player, (bankSummePlayer.get(e.player) ?? 0) + summe);
        bankSummeMaxPlayer.set(e.player, (bankSummeMaxPlayer.get(e.player) ?? 0) + summeMax);
      }
    }
  }

  // Chronological by Journey progress. Deaths recorded before this was
  // tracked (sortIndex -Infinity) stay at the top in their existing route
  // order until edited; equal progress falls back to when it was marked.
  memorial.sort(
    (a, b) => a.sortIndex - b.sortIndex || (a.diedAt ?? 0) - (b.diedAt ?? 0),
  );

  const deathTallyTotal = (caused.get(Player.PLAYER1) ?? 0) + (caused.get(Player.PLAYER2) ?? 0) + unattributedDeaths;
  const deathTally: OverviewDeathTally | null =
    mode === RunMode.SOULLINK && deathTallyTotal > 0
      ? {
          PLAYER1: caused.get(Player.PLAYER1) ?? 0,
          PLAYER2: caused.get(Player.PLAYER2) ?? 0,
          unattributed: unattributedDeaths,
        }
      : null;

  const stats: OverviewStats = {
    perPlayer: teams.map(({ player }) => ({
      player,
      caught: caught.get(player) ?? 0,
      teamSumme: teamSummePlayer.get(player) ?? 0,
      teamSummeMax: teamSummeMaxPlayer.get(player) ?? 0,
      bankSumme: bankSummePlayer.get(player) ?? 0,
      bankSummeMax: bankSummeMaxPlayer.get(player) ?? 0,
    })),
    totalDeaths,
    teamSumme,
    teamSummeMax,
    capCurrent,
    capNext,
  };

  const pokemonList = getPokemonListForGame(game);

  return (
    <BlindflugProvider on={settings.blindflug}>
    <SpriteSetProvider spriteSet={game.spriteSet} fusion={getFusionSpriteConfigForGame(game)}>
      <CanonicalRun runId={runId} />
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <PokemonDetailProvider
          pokemonList={pokemonList}
          forms={getPokemonFormsForGame(game)}
          evolutions={getEvolutions(evoOptions)}
          moveData={{
            movesets: getMoveset(game.versionGroup),
            moves: getMovesForGame(game, lang),
          }}
          moveTypeHistory={getMoveTypeHistory()}
          effectiveness={table}
          generation={getDataGenerationForGame(game)}
          dexLimit={game.dexLimit}
          lang={lang}
        >
          <OverviewView
            lang={lang}
            mode={mode}
            teams={teams}
            table={table}
            attackTypes={defenderTypes}
            offensiveGaps={offensiveGaps}
            coverageLevel={coverageLevel}
            hasMoveData={Object.keys(learnset).length > 0}
            stats={stats}
            deathTally={deathTally}
            memorial={memorial}
            runId={runId}
            deathPointOptions={levelCapItems.map((cap) => ({
              id: cap.id,
              label: `${localizeName(cap.names, lang)} · ${localizeName(cap.location, lang)}`,
            }))}
            routeProgress={routeProgress}
            levelCapProgress={levelCapProgress}
            levelCapMarkerAt={levelCapMarkerAt}
            badges={badges}
          />
        </PokemonDetailProvider>
      </PlayerNamesProvider>
    </SpriteSetProvider>
    </BlindflugProvider>
  );
}
