import { redirect } from "next/navigation";
import {
  getEffectiveness,
  getEvolutions,
  getGameOrDefault,
  getLearnset,
  getMoves,
  getMoveset,
  getPokemonById,
  getPokemonList,
} from "@/lib/data";
import { getTypesForGeneration } from "@/lib/effectiveness";
import { explosiveMove } from "@/lib/learnset";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { pokemonName } from "@/lib/i18n/localize";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { TeamMember } from "@/components/TeamWeaknessesView";
import { BattleView } from "@/components/BattleView";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";

// Run-scoped: the Battle tab uses the run's game (type chart, dex, sprites,
// level-up movesets) and its current team for the matchup comparison.
export const dynamic = "force-dynamic";

export default async function BattlePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/typen?run=${runId}`);

  const lang = await getLang();
  const game = getGameOrDefault(gameId);
  const moveset = getMoveset(game.versionGroup);
  const moves = getMoves();

  // Precompute which obtainable Pokémon can go boom (self-destruct/explosion)
  // so the Battle tab can warn about the selected opponent.
  const explosiveMap: Record<number, { name: string; level: number }> = {};
  for (const p of getPokemonList(game.dexLimit)) {
    const boom = explosiveMove(moveset, moves, p.id, lang);
    if (boom) explosiveMap[p.id] = { name: boom.name, level: boom.level };
  }

  const teamLinks = await prisma.soulLink.findMany({
    where: { runId, teamPosition: { not: null }, status: LinkStatus.ALIVE },
    include: { encounters: true },
    orderBy: { teamPosition: "asc" },
  });

  const byPlayer = new Map<Player, TeamMember[]>([
    [Player.PLAYER1, []],
    [Player.PLAYER2, []],
  ]);
  for (const link of teamLinks) {
    for (const e of link.encounters) {
      const pokemon = getPokemonById(e.currentPokemonId);
      if (!pokemon) continue;
      byPlayer.get(e.player)?.push({
        encounterId: e.id,
        pokemonId: e.currentPokemonId,
        name: pokemonName(pokemon, lang),
        types: typesForGeneration(e.currentPokemonId, pokemon.types, game.generation),
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

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <PokemonDetailProvider
          pokemonList={getPokemonList(game.dexLimit)}
          evolutions={getEvolutions({
            gameId,
            impossible: settings.evolutionOverridesImpossible,
            easier: settings.evolutionOverridesEasier,
          })}
          moveData={{ movesets: moveset, moves }}
          effectiveness={getEffectiveness(game.generation)}
          generation={game.generation}
          dexLimit={game.dexLimit}
          lang={lang}
        >
          <BattleView
            pokemonList={getPokemonList(game.dexLimit)}
            table={getEffectiveness(game.generation)}
            attackTypes={getTypesForGeneration(game.generation)}
            generation={game.generation}
            learnset={getLearnset(game.versionGroup)}
            teams={teams}
            mode={mode}
            explosiveMap={explosiveMap}
          />
        </PokemonDetailProvider>
      </PlayerNamesProvider>
    </SpriteSetProvider>
  );
}
