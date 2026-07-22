import { redirect } from "next/navigation";
import { getEffectiveness, getGameOrDefault, getPokemonById } from "@/lib/data";
import { getTypesForGeneration } from "@/lib/effectiveness";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { pokemonName } from "@/lib/i18n/localize";
import { LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { TeamMember } from "@/components/TeamWeaknessesView";
import { TeamWeaknessesView } from "@/components/TeamWeaknessesView";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";

export const dynamic = "force-dynamic";

export default async function WeaknessesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/weaknesses?run=${runId}`);
  const game = getGameOrDefault(gameId);

  const lang = await getLang();

  const teamLinks = await prisma.soulLink.findMany({
    where: { runId, teamPosition: { not: null }, status: LinkStatus.ALIVE },
    include: { encounters: true },
    orderBy: { teamPosition: "asc" },
  });

  // In SoulLink each player battles with their own 6 Pokémon, so weaknesses
  // are analysed per player; Classic only ever has PLAYER1 members.
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
        <TeamWeaknessesView
          lang={lang}
          mode={mode}
          teams={teams}
          table={getEffectiveness(game.generation)}
          attackTypes={getTypesForGeneration(game.generation)}
        />
      </PlayerNamesProvider>
    </SpriteSetProvider>
  );
}
