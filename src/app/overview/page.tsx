import {
  getEffectiveness,
  getEvolutionById,
  getEvolutions,
  getGameOrDefault,
  getLearnset,
  getLevelCaps,
  getMoves,
  getMoveset,
  getMoveTypeHistory,
  getPokemonById,
  getPokemonList,
  getPokemonForms,
  getRouteById,
  getRoutes,
} from "@/lib/data";
import { getTypesForGeneration, teamOffensiveCoverage } from "@/lib/effectiveness";
import { attackTypesAtLevel } from "@/lib/learnset";
import { maxEvolvedSumme } from "@/lib/evolutions";
import { computeLevelCapProgress, computeRouteProgress, eliteFourIndex } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { localizeName, pokemonName, routeName } from "@/lib/i18n/localize";
import { displayNameWithForm, movepoolId } from "@/lib/forms";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { CanonicalRun } from "@/components/CanonicalRun";
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
  const routeOrder = new Map(getRoutes(gameId).map((r, i) => [r.id, i]));
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

  // --- Team (alive + on a slot) per player: defensive + offensive coverage.
  const teamByPlayer = new Map<Player, TeamMember[]>(PLAYERS.map((p) => [p, []]));
  for (const link of soulLinks) {
    if (link.status === LinkStatus.DEAD || link.teamPosition === null) continue;
    for (const e of link.encounters) {
      const pokemon = getPokemonById(e.currentPokemonId, game.generation);
      if (!pokemon) continue;
      teamByPlayer.get(e.player)?.push({
        encounterId: e.id,
        pokemonId: e.currentPokemonId,
        // Formes with their own movepool keep it; the rest fall back.
        speciesId: movepoolId(pokemon, (id) => learnset[String(id)] !== undefined),
        name: displayNameWithForm(pokemon, lang),
        types: pokemon.types,
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
    getRoutes(gameId),
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
  const table = getEffectiveness(game.generation);
  const defenderTypes = getTypesForGeneration(game.generation);
  const coverageLevel = capCurrent ?? FALLBACK_LEVEL;
  const offensiveGaps = teams.map(({ player, members }) => {
    const atkTypes = new Set<string>();
    for (const m of members) {
      for (const a of attackTypesAtLevel(learnset, m.speciesId, coverageLevel)) atkTypes.add(a.type);
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

  for (const link of soulLinks) {
    const isDead = link.status === LinkStatus.DEAD;
    if (isDead) {
      totalDeaths++;
      // Death-tally scoreboard: only pairs that actually formed (both
      // players caught) count, same as the Journey tab's version did.
      if (link.encounters.length >= 2) {
        if (link.deathPlayer) caused.set(link.deathPlayer, (caused.get(link.deathPlayer) ?? 0) + 1);
        else unattributedDeaths++;
      }
      const route = getRouteById(gameId, link.routeId);
      memorial.push({
        soulLinkId: link.id,
        routeName: route ? routeName(route, lang) : `Route #${link.routeId}`,
        pokemon: link.encounters.map((e) => {
          const p = getPokemonById(e.currentPokemonId, game.generation);
          const species = p ? pokemonName(p, lang) : `#${e.currentPokemonId}`;
          const nick = settings.nicknames && e.nickname ? e.nickname : null;
          return { id: e.currentPokemonId, name: nick ?? species, species: nick ? species : null };
        }),
        deathPlayer: link.deathPlayer,
        deathCause: link.deathCause,
        deathLevelCapId: link.deathLevelCapId,
        deathPointLabel:
          link.deathLevelCapId !== null
            ? (() => {
                const cap = levelCapItems.find((c) => c.id === link.deathLevelCapId);
                return cap ? `${localizeName(cap.names, lang)} · ${localizeName(cap.location, lang)}` : null;
              })()
            : null,
        // null = predates death-point tracking; those park at the top until
        // edited. A recorded death with no cap yet has diedAt set and sorts
        // ahead of every cap instead.
        recorded: link.diedAt !== null,
        sortIndex:
          link.diedAt === null
            ? -Infinity
            : link.deathLevelCapId === null
              ? -1
              : (capOrder.get(link.deathLevelCapId) ?? Number.MAX_SAFE_INTEGER),
        diedAt: link.diedAt?.getTime() ?? null,
      });
    }
    if (isDead) continue;
    for (const e of link.encounters) {
      if (e.status !== EncounterStatus.CAUGHT) continue;
      caught.set(e.player, (caught.get(e.player) ?? 0) + 1);
      const summe = getPokemonById(e.currentPokemonId, game.generation)?.stats.Summe ?? 0;
      const summeMax = maxEvolvedSumme(
        e.currentPokemonId,
        (id) => getEvolutionById(id, evoOptions)?.evolvesTo ?? [],
        (id) => getPokemonById(id, game.generation)?.stats.Summe ?? 0,
        game.dexLimit,
      );
      if (link.teamPosition !== null) {
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

  const pokemonList = getPokemonList(game.dexLimit, game.generation);

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <CanonicalRun runId={runId} />
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <PokemonDetailProvider
          pokemonList={pokemonList}
          forms={getPokemonForms(game.dexLimit, game.generation)}
          evolutions={getEvolutions(evoOptions)}
          moveData={{
            movesets: getMoveset(game.versionGroup),
            moves: getMoves(lang, game.generation),
          }}
          moveTypeHistory={getMoveTypeHistory()}
          effectiveness={table}
          generation={game.generation}
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
  );
}
