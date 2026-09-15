import { getEvolutions, getGameOrDefault, getMoveset, getMoveTypeHistory, getTmCompat } from "@/lib/data";
import {
  getEffectivenessForGame,
  getPokemonByIdForGame,
  getPokemonListForGame,
  getPokemonFormsForGame,
  getMovesForGame,
  getDataGenerationForGame,
  getFusionSpriteConfigForGame,
} from "@/lib/gameData";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { displayNameWithForm, movepoolId } from "@/lib/forms";
import { teamLinkIds } from "@/lib/fusionGroups";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { CanonicalRun } from "@/components/CanonicalRun";
import { BlindflugProvider } from "@/components/BlindflugProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { TmCompatView, type TmTeamMember } from "@/components/TmCompatView";
import type { MoveOption } from "@/components/MoveCombobox";

export const dynamic = "force-dynamic";

export default async function TmsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings } = await resolveRunId(run);
  const game = getGameOrDefault(gameId);
  const lang = await getLang();

  // Read before the team loop below, which consults it to decide whether a
  // forme keeps its own movepool or falls back to its species.
  const moveset = getMoveset(game.versionGroup);

  // All LIVING caught Pokémon (status CAUGHT, link not dead), per player,
  // de-duplicated by current species (learnability is species-based).
  const caught = await prisma.encounter.findMany({
    where: { runId, status: EncounterStatus.CAUGHT },
    include: { soulLink: true },
    orderBy: { id: "asc" },
  });
  // "On the team" is asked of the encounter's fusion group, not of its own
  // link (see src/lib/fusionGroups.ts) - the same as link.teamPosition in any
  // run without fusions.
  const onTeamLinkIds = teamLinkIds(
    await prisma.soulLink.findMany({ where: { runId }, include: { encounters: true } }),
  );
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
    const pokemon = getPokemonByIdForGame(game, e.currentPokemonId);
    if (!pokemon) continue;
    const onTeam = e.soulLinkId !== null && onTeamLinkIds.has(e.soulLinkId);
    const members = byPlayer.get(e.player);
    if (seen.get(e.player)?.has(e.currentPokemonId)) {
      // Same species caught twice: it counts as "on the team" if ANY of them
      // holds a team slot, so the dedup can't hide it down in the bank.
      const existing = members?.find((m) => m.pokemonId === e.currentPokemonId);
      if (existing && onTeam) existing.onTeam = true;
      continue;
    }
    seen.get(e.player)?.add(e.currentPokemonId);
    members?.push({
      pokemonId: e.currentPokemonId,
      speciesId: movepoolId(pokemon, (id) => moveset[String(id)] !== undefined),
      name: displayNameWithForm(pokemon, lang),
      onTeam,
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
  const tmCompat = getTmCompat(game.versionGroup);
  const moveTypeHistory = getMoveTypeHistory();
  // With lang, so the move descriptions reach both the selected-move summary
  // and the Pokédex card opened from a team row.
  const movesTable = getMovesForGame(game, lang);
  const slugs = new Set<string>(Object.keys(tmCompat));
  for (const list of Object.values(moveset)) for (const [, slug] of list) slugs.add(slug);
  const moves: MoveOption[] = [...slugs]
    .map((slug) => {
      const info = movesTable[slug];
      return { slug, name: info?.names[lang] ?? info?.names.en ?? slug, type: info?.type ?? "normal" };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <BlindflugProvider on={settings.blindflug}>
    <SpriteSetProvider spriteSet={game.spriteSet} fusion={getFusionSpriteConfigForGame(game)}>
      <CanonicalRun runId={runId} />
      <PlayerNamesProvider names={settings.playerNames} lang={lang}>
        <PokemonDetailProvider
          pokemonList={getPokemonListForGame(game)}
          forms={getPokemonFormsForGame(game)}
          evolutions={getEvolutions({
            gameId,
            impossible: settings.evolutionOverridesImpossible,
            easier: settings.evolutionOverridesEasier,
            timeBased: settings.evolutionOverridesTimeBased,
          })}
          moveData={{ movesets: moveset, moves: movesTable }}
          moveTypeHistory={moveTypeHistory}
          effectiveness={getEffectivenessForGame(game)}
          generation={getDataGenerationForGame(game)}
          dexLimit={game.dexLimit}
          lang={lang}
        >
          <TmCompatView
            lang={lang}
            mode={mode}
            teams={teams}
            moves={moves}
            tmCompat={tmCompat}
            moveset={moveset}
            movesTable={movesTable}
            generation={getDataGenerationForGame(game)}
            moveTypeHistory={moveTypeHistory}
            // Infinite Fusion ships neither (see CLAUDE.md).
            hasMoveData={Object.keys(tmCompat).length > 0 || Object.keys(moveset).length > 0}
          />
        </PokemonDetailProvider>
      </PlayerNamesProvider>
    </SpriteSetProvider>
    </BlindflugProvider>
  );
}
