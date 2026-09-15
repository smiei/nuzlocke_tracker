import {
  getGameOrDefault,
  getEvolutionById,
  getEvolutions,
  getMoveTypeHistory,
  getMoveset,
  getLevelCaps,
} from "@/lib/data";
import {
  getEffectivenessForGame,
  getPokemonByIdForGame,
  getPokemonListForGame,
  getPokemonFormsForGame,
  getMovesForGame,
  getDataGenerationForGame,
  getFusionSpriteConfigForGame,
  isInDex,
} from "@/lib/gameData";
import { getRoutesForRun } from "@/lib/runRoutes";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { CanonicalRun } from "@/components/CanonicalRun";
import { BlindflugProvider } from "@/components/BlindflugProvider";
import { PageHeader } from "@/components/ui/Page";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";
import { computePokemonRanks, rankForSumme } from "@/lib/ranking";
import { displayNameWithForm, formLabel, formsOfSpecies } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { routeName, pokemonName } from "@/lib/i18n/localize";
import { formatEvolutionMethod } from "@/lib/evolutionMethods";
import { LinksView } from "@/components/LinksView";
import { resolveEncounterMon } from "@/lib/encounterMon";
import { groupSoulLinks, isFoldedDonor, teamSlotsNeeded } from "@/lib/fusionGroups";
import type { SoulLinkView, FusableEncounter, EvolutionOptions } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings } = await resolveRunId(run);
  // The two randomizer rules decide which override categories from the game
  // pack's evolution-overrides.json apply (vs. vanilla methods).
  const evoOptions = {
    gameId,
    impossible: settings.evolutionOverridesImpossible,
    easier: settings.evolutionOverridesEasier,
    timeBased: settings.evolutionOverridesTimeBased,
  };

  const lang = await getLang();

  // A SoulLink pair only forms if BOTH players catch. If one player's
  // encounter on the route is Fled/Killed, the pair never formed - the
  // surviving catch is boxed and must NOT show here as a usable link (it
  // stays visible on the Tracker tab, which records every raw encounter).
  // Classic runs have no partner, so nothing is ever hidden there.
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

  const rawSoulLinks = await prisma.soulLink.findMany({
    where: { runId },
    include: { encounters: true },
  });
  const soulLinks = rawSoulLinks.filter((link) => !failedRouteIds.has(link.routeId));
  // Infinite Fusion: host encounter id -> its donor (the fusion's body).
  const donorByHostId = new Map(
    rawSoulLinks
      .flatMap((link) => link.encounters)
      .filter((e) => e.fusedIntoId !== null)
      .map((e) => [e.fusedIntoId as number, e]),
  );
  // Ranks are computed within the game's dex, so "Rang #X" means the same
  // thing the Pokédex tab shows for that game.
  const game = getGameOrDefault(gameId);
  const pokemonList = getPokemonListForGame(game);
  // Alternate formes are NOT part of pokemonList (ids 10001+ are outside the
  // dex limit by construction) - they're a state a caught Pokémon switches
  // into, never something the Pokédex lists.
  const formEntries = getPokemonFormsForGame(game);
  const ranks = computePokemonRanks(pokemonList);

  // Current level cap = the LAST DEFEATED Journey milestone with a cap (the
  // cap you have earned). House rule: only one Pokémon may reach the cap
  // itself, everyone else stays at cap-2 - so evolution availability is
  // judged against cap-2. Nothing defeated yet -> no cap earned, nothing
  // highlights.
  const progress = await prisma.levelCapProgress.findMany({ where: { runId } });
  const defeatedIds = new Set(progress.filter((p) => p.defeated).map((p) => p.levelCapId));
  const lastDefeatedCap = getLevelCaps(gameId)
    .filter((c) => c.max_level !== null && defeatedIds.has(c.id))
    .at(-1);
  const allowedLevel = lastDefeatedCap?.max_level != null ? lastDefeatedCap.max_level - 2 : 0;

  // One lookup table for both the name and the sort below, and it resolves
  // the run's own added routes as well as the pack's.
  const routes = await getRoutesForRun(runId, gameId);
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const routeNameOf = (routeId: number) => {
    const route = routeById.get(routeId);
    return route ? routeName(route, lang) : `Route #${routeId}`;
  };
  // Encounter order = the position in routes.json, NOT the route id. Ids are
  // frozen forever while the array order is the display order and gets
  // reshuffled (FireRed's list was reordered), so sorting by id replays
  // whatever order the pack happened to have when the ids were handed out.
  // Routes no longer in the pack sort last rather than to the front.
  const routeOrder = new Map(routes.map((r, i) => [r.id, i]));
  const orderOfRoute = (routeId: number) => routeOrder.get(routeId) ?? Number.MAX_SAFE_INTEGER;

  // Shared by a host row and its donor's body sub-object - see EvolutionOptions.
  function buildEvolutionOptions(currentPokemonId: number): EvolutionOptions {
    const pokemon = getPokemonByIdForGame(game, currentPokemonId);
    const evo = getEvolutionById(currentPokemonId, evoOptions);
    const speciesId = pokemon ? pokemon.baseId ?? pokemon.id : currentPokemonId;
    return {
      formOptions: formsOfSpecies(speciesId, pokemonList, formEntries).map((f) => ({
        id: f.id,
        label: formLabel(f, lang),
        summe: f.stats.Summe,
      })),
      // Evolutions beyond the game's dex (e.g. Crobat in Gen 1, Magnezone in
      // Gen 3) don't exist in that game - filter them out entirely.
      evolvesTo: (evo?.evolvesTo ?? [])
        .filter((id) => isInDex(game, id))
        .map((id) => {
          const p = getPokemonByIdForGame(game, id);
          const targetEvo = getEvolutionById(id, evoOptions);
          const method = targetEvo?.method ?? null;
          return {
            id,
            name: p ? pokemonName(p, lang) : `#${id}`,
            method: method ? formatEvolutionMethod(method, lang) : null,
            // Only plain level evolutions count as "reachable now" -
            // item/trade/friendship evolutions have no level gate.
            available: method?.kind === "level" && method.level <= allowedLevel,
          };
        }),
      evolvesFrom: (() => {
        // Pre-evos introduced later (e.g. Pichu for Pikachu) don't exist in
        // older games either.
        if (!evo?.evolvesFrom || !isInDex(game, evo.evolvesFrom)) return null;
        const p = getPokemonByIdForGame(game, evo.evolvesFrom);
        return { id: evo.evolvesFrom, name: p ? pokemonName(p, lang) : `#${evo.evolvesFrom}` };
      })(),
    };
  }

  const encounterMonDeps = {
    pokemonById: (id: number) => getPokemonByIdForGame(game, id),
    evolvesTo: (id: number) => getEvolutionById(id, evoOptions)?.evolvesTo ?? [],
    inDex: (id: number) => isInDex(game, id),
    lang,
  };

  // One card per fusion GROUP, not per route (see src/lib/fusionGroups.ts):
  // once a fusion joins two routes, a per-route card pairs one player's fusion
  // with the other player's leftover donor. Inside a group every player's
  // battle units are listed - a donor is folded into its host's tile as the
  // body, never a tile of its own. Without fusions every group is exactly one
  // link, which is the old one-card-per-route view unchanged.
  const orderedLinks = [...soulLinks].sort((a, b) => orderOfRoute(a.routeId) - orderOfRoute(b.routeId));
  const linkById = new Map(orderedLinks.map((link) => [link.id, link]));
  const groups = groupSoulLinks(
    orderedLinks.map((link) => link.id),
    orderedLinks.flatMap((link) => link.encounters),
  );

  const views: SoulLinkView[] = groups.map((linkIds) => {
    const members = linkIds.map((id) => linkById.get(id)!);
    const first = members[0];
    const groupEncounters = members.flatMap((link) => link.encounters);
    const groupEncounterIds = new Set(groupEncounters.map((e) => e.id));
    // markDead/markAlive propagate across the whole group, so its links share
    // one status; "every link dead" is only the defensive reading of it.
    const deadMember = members.find((link) => link.status === LinkStatus.DEAD);
    // Capped at what the group needs: a run fused before group slot
    // bookkeeping existed can still hold a surplus slot, which is shown (and
    // treated by setTeamSlot) as free.
    const teamPositions = members
      .flatMap((link) => (link.teamPosition === null ? [] : [link.teamPosition]))
      .sort((a, b) => a - b)
      .slice(0, teamSlotsNeeded(groupEncounters));
    // Player 1 above Player 2, never by strength; within a player, route order.
    const units = groupEncounters
      .filter((e) => !isFoldedDonor(e, groupEncounterIds))
      .sort((a, b) =>
        a.player !== b.player
          ? a.player === Player.PLAYER1
            ? -1
            : 1
          : orderOfRoute(a.routeId) - orderOfRoute(b.routeId),
      );

    return {
      id: first.id,
      linkIds,
      routeId: first.routeId,
      routeName: members.map((link) => routeNameOf(link.routeId)).join(" + "),
      status: members.every((link) => link.status === LinkStatus.DEAD) ? LinkStatus.DEAD : LinkStatus.ALIVE,
      teamPosition: teamPositions[0] ?? null,
      teamPositions,
      deathPlayer: deadMember?.deathPlayer ?? null,
      deathCause: deadMember?.deathCause ?? null,
      encounters: units.map((e) => {
        // Links shows the current (possibly evolved) form - pokemonId (what
        // was actually caught) is what the Tracker tab shows and never
        // changes here.
        const donor = donorByHostId.get(e.id);
        const effective = resolveEncounterMon(e.currentPokemonId, donor?.currentPokemonId, encounterMonDeps);
        const pokemon = getPokemonByIdForGame(game, e.currentPokemonId);
        return {
          id: e.id,
          player: e.player,
          routeName: routeNameOf(e.routeId),
          pokemonId: e.currentPokemonId,
          pokemonName: effective?.name ?? `#${e.currentPokemonId}`,
          // Gated here so display components stay settings-agnostic.
          nickname: settings.nicknames ? e.nickname : null,
          types: effective?.types ?? [],
          summe: effective?.stats.Summe ?? 0,
          summeMax: effective?.summeMax ?? 0,
          // A forme isn't in the ranked pool (that would shift every
          // species' rank); rank it against the species by its own BST
          // instead. No rank at all for a fusion - see CLAUDE.md.
          rang: donor
            ? 0
            : (ranks.get(e.currentPokemonId) ??
              (pokemon ? rankForSumme(pokemonList, pokemon.stats.Summe) : 0)),
          status: e.status,
          isStatic: e.isStatic,
          shiny: e.shiny,
          body: donor
            ? (() => {
                const bodyPokemon = getPokemonByIdForGame(game, donor.currentPokemonId);
                return {
                  encounterId: donor.id,
                  pokemonId: donor.currentPokemonId,
                  pokemonName: bodyPokemon
                    ? displayNameWithForm(bodyPokemon, lang)
                    : `#${donor.currentPokemonId}`,
                  routeName: routeNameOf(donor.routeId),
                  ...buildEvolutionOptions(donor.currentPokemonId),
                };
              })()
            : null,
          ...buildEvolutionOptions(e.currentPokemonId),
        };
      }),
    };
  });

  // Dead cards last; otherwise the order of each card's first route.
  views.sort((a, b) => {
    if (a.status !== b.status) return a.status === "DEAD" ? 1 : -1;
    return orderOfRoute(a.routeId) - orderOfRoute(b.routeId);
  });

  // Infinite Fusion: every catch that could be used as either side of a new
  // fusion - CAUGHT, its link ALIVE and actually formed (a boxed catch of a
  // never-formed pair isn't usable), not already a donor, and not already a
  // host. Flat, run-wide list for the fuse dialog's picker (mirrors
  // pokemonList/teamLinks), not per-card.
  const hostIds = new Set(donorByHostId.keys());
  const fusableEncounters: FusableEncounter[] = game.fusion
    ? soulLinks
        .filter((link) => link.status !== LinkStatus.DEAD)
        .flatMap((link) =>
          link.encounters
            .filter(
              (e) =>
                e.status === EncounterStatus.CAUGHT &&
                e.fusedIntoId === null &&
                !hostIds.has(e.id),
            )
            .map((e) => {
              const pokemon = getPokemonByIdForGame(game, e.currentPokemonId);
              return {
                id: e.id,
                player: e.player,
                pokemonId: e.currentPokemonId,
                routeName: routeNameOf(link.routeId),
                pokemonName: pokemon ? displayNameWithForm(pokemon, lang) : `#${e.currentPokemonId}`,
              };
            }),
        )
    : [];

  const heading = translations[lang].nav.links;

  return (
    <BlindflugProvider on={settings.blindflug}>
    <div>
      <CanonicalRun runId={runId} />
      <PageHeader title={heading} />
      <SpriteSetProvider spriteSet={game.spriteSet} fusion={getFusionSpriteConfigForGame(game)}>
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
            effectiveness={getEffectivenessForGame(game)}
            generation={getDataGenerationForGame(game)}
            dexLimit={game.dexLimit}
            lang={lang}
          >
            <LinksView
              runId={runId}
              mode={mode}
              lang={lang}
              soulLinks={views}
              freeTeam={settings.freeTeam}
              pokemonList={pokemonList}
              fusionEnabled={Boolean(game.fusion)}
              fusableEncounters={fusableEncounters}
              customSpritesOnly={settings.customSpritesOnly}
            />
          </PokemonDetailProvider>
        </PlayerNamesProvider>
      </SpriteSetProvider>
    </div>
    </BlindflugProvider>
  );
}
