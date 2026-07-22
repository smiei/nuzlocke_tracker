import { redirect } from "next/navigation";
import {
  getGameOrDefault,
  getMoves,
  getMoveset,
  getPokemonById,
  getTmCompat,
} from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { pokemonName } from "@/lib/i18n/localize";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";
import { TmCompatView, type TmTeamMember } from "@/components/TmCompatView";
import type { MoveOption } from "@/components/MoveCombobox";

export const dynamic = "force-dynamic";

export default async function TmsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/tms?run=${runId}`);
  const game = getGameOrDefault(gameId);
  const lang = await getLang();

  // All LIVING caught Pokémon (status CAUGHT, link not dead), per player,
  // de-duplicated by current species (learnability is species-based).
  const caught = await prisma.encounter.findMany({
    where: { runId, status: EncounterStatus.CAUGHT },
    include: { soulLink: true },
    orderBy: { id: "asc" },
  });
  const byPlayer = new Map<Player, TmTeamMember[]>([
    [Player.PLAYER1, []],
    [Player.PLAYER2, []],
  ]);
  const seen = new Map<Player, Set<number>>([
    [Player.PLAYER1, new Set()],
    [Player.PLAYER2, new Set()],
  ]);
  for (const e of caught) {
    if (e.soulLink?.status === LinkStatus.DEAD) continue;
    const pokemon = getPokemonById(e.currentPokemonId);
    if (!pokemon) continue;
    if (seen.get(e.player)?.has(e.currentPokemonId)) continue;
    seen.get(e.player)?.add(e.currentPokemonId);
    byPlayer.get(e.player)?.push({
      pokemonId: e.currentPokemonId,
      name: pokemonName(pokemon, lang),
    });
  }

  const teams =
    mode === RunMode.CLASSIC
      ? [{ player: Player.PLAYER1, members: byPlayer.get(Player.PLAYER1) ?? [] }]
      : [
          { player: Player.PLAYER1, members: byPlayer.get(Player.PLAYER1) ?? [] },
          { player: Player.PLAYER2, members: byPlayer.get(Player.PLAYER2) ?? [] },
        ];

  // Selectable moves = the move universe of this game (level-up + machine +
  // tutor moves), localized and sorted by name.
  const moveset = getMoveset(game.versionGroup);
  const tmCompat = getTmCompat(game.versionGroup);
  const movesTable = getMoves();
  const slugs = new Set<string>(Object.keys(tmCompat));
  for (const list of Object.values(moveset)) for (const [, slug] of list) slugs.add(slug);
  const moves: MoveOption[] = [...slugs]
    .map((slug) => {
      const info = movesTable[slug];
      return { slug, name: info?.names[lang] ?? info?.names.en ?? slug, type: info?.type ?? "normal" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <TmCompatView
          lang={lang}
          mode={mode}
          teams={teams}
          moves={moves}
          tmCompat={tmCompat}
          moveset={moveset}
        />
      </PlayerNamesProvider>
    </SpriteSetProvider>
  );
}
