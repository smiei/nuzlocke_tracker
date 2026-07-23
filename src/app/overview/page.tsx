import { redirect } from "next/navigation";
import {
  getEffectiveness,
  getEvolutionById,
  getGameOrDefault,
  getLearnset,
  getLevelCaps,
  getPokemonById,
  getRouteById,
} from "@/lib/data";
import { getTypesForGeneration, teamOffensiveCoverage } from "@/lib/effectiveness";
import { attackTypesAtLevel } from "@/lib/learnset";
import { maxEvolvedSumme } from "@/lib/evolutions";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { pokemonName, routeName } from "@/lib/i18n/localize";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";
import {
  OverviewView,
  type OverviewMemorialEntry,
  type OverviewStats,
} from "@/components/OverviewView";
import type { TeamMember } from "@/components/TeamWeaknessesView";

export const dynamic = "force-dynamic";

const PLAYERS = [Player.PLAYER1, Player.PLAYER2] as const;

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/overview?run=${runId}`);
  const game = getGameOrDefault(gameId);
  const lang = await getLang();

  // A pair only forms if BOTH players catch. If a route has a Fled/Killed
  // encounter, the pair never formed - the surviving catch is boxed and any
  // "dead" mark on it must NOT count as a death or show in the Memorial
  // (mirrors what the Pokémon tab hides). Classic runs never hide anything.
  // A player's "missed encounters" = their own Fled/Killed catches (a partner
  // catching on the same route is a separate, successful encounter and never
  // counts against them). Same query also yields the failed routes to hide.
  const failedEncounters = await prisma.encounter.findMany({
    where: { runId, status: { in: [EncounterStatus.FLED, EncounterStatus.KILLED] } },
    select: { routeId: true, player: true },
  });
  const missed = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  for (const e of failedEncounters) missed.set(e.player, (missed.get(e.player) ?? 0) + 1);
  const failedRouteIds =
    mode === RunMode.SOULLINK
      ? new Set(failedEncounters.map((e) => e.routeId))
      : new Set<number>();

  const soulLinks = (
    await prisma.soulLink.findMany({
      where: { runId },
      include: { encounters: true },
      orderBy: { routeId: "asc" },
    })
  ).filter((link) => !failedRouteIds.has(link.routeId));
  const progress = await prisma.levelCapProgress.findMany({ where: { runId } });
  const evoOptions = {
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
  };

  // --- Team (alive + on a slot) per player: defensive + offensive coverage.
  const teamByPlayer = new Map<Player, TeamMember[]>(PLAYERS.map((p) => [p, []]));
  for (const link of soulLinks) {
    if (link.status === LinkStatus.DEAD || link.teamPosition === null) continue;
    for (const e of link.encounters) {
      const pokemon = getPokemonById(e.currentPokemonId);
      if (!pokemon) continue;
      teamByPlayer.get(e.player)?.push({
        encounterId: e.id,
        pokemonId: e.currentPokemonId,
        name: pokemonName(pokemon, lang),
        types: typesForGeneration(e.currentPokemonId, pokemon.types, game.generation),
      });
    }
  }
  const teams =
    mode === RunMode.CLASSIC
      ? [{ player: Player.PLAYER1, members: teamByPlayer.get(Player.PLAYER1) ?? [] }]
      : PLAYERS.map((p) => ({ player: p, members: teamByPlayer.get(p) ?? [] }));

  // --- Offensive coverage gaps per player.
  const table = getEffectiveness(game.generation);
  const defenderTypes = getTypesForGeneration(game.generation);
  const learnset = getLearnset(game.versionGroup);
  const offensiveGaps = teams.map(({ player, members }) => {
    const atkTypes = new Set<string>();
    for (const m of members) {
      for (const a of attackTypesAtLevel(learnset, m.pokemonId, 100)) atkTypes.add(a.type);
    }
    return { player, gaps: teamOffensiveCoverage(table, [...atkTypes], defenderTypes).gaps };
  });

  // --- Counts, team BST and the memorial in one pass over the links.
  const caught = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  const caused = new Map<Player, number>(PLAYERS.map((p) => [p, 0]));
  let totalDeaths = 0;
  let teamSumme = 0;
  let teamSummeMax = 0;
  const memorial: OverviewMemorialEntry[] = [];

  for (const link of soulLinks) {
    const isDead = link.status === LinkStatus.DEAD;
    if (isDead) {
      totalDeaths++;
      // "Caused" mirrors the Journey scoreboard: only pairs that actually formed.
      if (link.deathPlayer && link.encounters.length >= 2) {
        caused.set(link.deathPlayer, (caused.get(link.deathPlayer) ?? 0) + 1);
      }
      const route = getRouteById(gameId, link.routeId);
      memorial.push({
        soulLinkId: link.id,
        routeName: route ? routeName(route, lang) : `Route #${link.routeId}`,
        pokemon: link.encounters.map((e) => {
          const p = getPokemonById(e.currentPokemonId);
          const species = p ? pokemonName(p, lang) : `#${e.currentPokemonId}`;
          const nick = settings.nicknames && e.nickname ? e.nickname : null;
          return { id: e.currentPokemonId, name: nick ?? species, species: nick ? species : null };
        }),
        deathPlayer: link.deathPlayer,
        deathCause: link.deathCause,
      });
    }
    if (isDead) continue;
    for (const e of link.encounters) {
      if (e.status !== EncounterStatus.CAUGHT) continue;
      caught.set(e.player, (caught.get(e.player) ?? 0) + 1);
      if (link.teamPosition !== null) {
        teamSumme += getPokemonById(e.currentPokemonId)?.stats.Summe ?? 0;
        teamSummeMax += maxEvolvedSumme(
          e.currentPokemonId,
          (id) => getEvolutionById(id, evoOptions)?.evolvesTo ?? [],
          (id) => getPokemonById(id)?.stats.Summe ?? 0,
          game.dexLimit,
        );
      }
    }
  }

  // Level caps: last earned cap + the next one.
  const defeatedIds = new Set(progress.filter((p) => p.defeated).map((p) => p.levelCapId));
  const caps = getLevelCaps(gameId).filter((c) => c.max_level !== null);
  const capCurrent = caps.filter((c) => defeatedIds.has(c.id)).at(-1)?.max_level ?? null;
  const capNext = caps.find((c) => !defeatedIds.has(c.id))?.max_level ?? null;

  const stats: OverviewStats = {
    perPlayer: teams.map(({ player }) => ({
      player,
      caught: caught.get(player) ?? 0,
      missed: missed.get(player) ?? 0,
      caused: caused.get(player) ?? 0,
    })),
    totalDeaths,
    teamSumme,
    teamSummeMax,
    capCurrent,
    capNext,
  };

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <OverviewView
          lang={lang}
          mode={mode}
          teams={teams}
          table={table}
          attackTypes={defenderTypes}
          offensiveGaps={offensiveGaps}
          stats={stats}
          memorial={memorial}
        />
      </PlayerNamesProvider>
    </SpriteSetProvider>
  );
}
