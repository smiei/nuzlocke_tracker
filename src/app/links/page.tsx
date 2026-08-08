import { redirect } from "next/navigation";
import {
  getEffectiveness,
  getGameOrDefault,
  getRouteById,
  getPokemonById,
  getPokemonList,
  getEvolutionById,
  getEvolutions,
  getMoves,
  getMoveTypeHistory,
  getMoveset,
  getLevelCaps,
  getRoutes,
  getPokemonForms,
} from "@/lib/data";
import { EncounterStatus, Player, RunMode } from "@/generated/prisma/client";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";
import { PokemonDetailProvider } from "@/components/PokemonDetailProvider";
import { PlayerNamesProvider } from "@/components/PlayerNamesProvider";
import { computePokemonRanks, rankForSumme } from "@/lib/ranking";
import { maxEvolvedSumme } from "@/lib/evolutions";
import { displayNameWithForm, formLabel, formsOfSpecies } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { routeName, pokemonName } from "@/lib/i18n/localize";
import { formatEvolutionMethod } from "@/lib/evolutionMethods";
import { typesForGeneration } from "@/lib/pokemonTypes";
import { LinksView } from "@/components/LinksView";
import type { SoulLinkView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/links?run=${runId}`);
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

  const soulLinks = (
    await prisma.soulLink.findMany({
      where: { runId },
      include: { encounters: true },
    })
  ).filter((link) => !failedRouteIds.has(link.routeId));
  // Ranks are computed within the game's dex, so "Rang #X" means the same
  // thing the Pokédex tab shows for that game.
  const game = getGameOrDefault(gameId);
  const pokemonList = getPokemonList(game.dexLimit);
  // Alternate formes are NOT part of pokemonList (ids 10001+ are outside the
  // dex limit by construction) - they're a state a caught Pokémon switches
  // into, never something the Pokédex lists.
  const formEntries = getPokemonForms(game.dexLimit);
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

  const views: SoulLinkView[] = soulLinks.map((link) => ({
    id: link.id,
    routeId: link.routeId,
    routeName: (() => {
      const route = getRouteById(gameId, link.routeId);
      return route ? routeName(route, lang) : `Route #${link.routeId}`;
    })(),
    status: link.status,
    teamPosition: link.teamPosition,
    deathPlayer: link.deathPlayer,
    deathCause: link.deathCause,
    // Within a tile always show Player 1 above Player 2, never by strength.
    encounters: [...link.encounters]
      .sort((a, b) => (a.player === Player.PLAYER1 ? -1 : 1) - (b.player === Player.PLAYER1 ? -1 : 1))
      .map((e) => {
      // Links shows the current (possibly evolved) form - pokemonId (what was
      // actually caught) is what the Tracker tab shows and never changes here.
      const pokemon = getPokemonById(e.currentPokemonId);
      const evo = getEvolutionById(e.currentPokemonId, evoOptions);
      // Alternate formes of whatever it currently is (base included), so the
      // picker can switch both ways. Empty for the vast majority of species.
      const speciesId = pokemon ? pokemon.baseId ?? pokemon.id : e.currentPokemonId;
      return {
        id: e.id,
        player: e.player,
        pokemonId: e.currentPokemonId,
        pokemonName: pokemon
          ? displayNameWithForm(pokemon, lang)
          : `#${e.currentPokemonId}`,
        formOptions: formsOfSpecies(speciesId, pokemonList, formEntries).map((f) => ({
          id: f.id,
          label: formLabel(f, lang),
          summe: f.stats.Summe,
        })),
        // Gated here so display components stay settings-agnostic.
        nickname: settings.nicknames ? e.nickname : null,
        types: typesForGeneration(e.currentPokemonId, pokemon?.types ?? [], game.generation),
        summe: pokemon?.stats.Summe ?? 0,
        // Best BST the caught form could still reach by evolving in this game.
        summeMax: maxEvolvedSumme(
          e.currentPokemonId,
          (id) => getEvolutionById(id, evoOptions)?.evolvesTo ?? [],
          (id) => getPokemonById(id)?.stats.Summe ?? 0,
          game.dexLimit,
        ),
        // A forme isn't in the ranked pool (that would shift every species'
        // rank); rank it against the species by its own BST instead.
        rang:
          ranks.get(e.currentPokemonId) ??
          (pokemon ? rankForSumme(pokemonList, pokemon.stats.Summe) : 0),
        status: e.status,
        isStatic: e.isStatic,
        shiny: e.shiny,
        // Evolutions beyond the game's dex (e.g. Crobat in Gen 1, Magnezone
        // in Gen 3) don't exist in that game - filter them out entirely.
        evolvesTo: (evo?.evolvesTo ?? [])
          .filter((id) => id <= game.dexLimit)
          .map((id) => {
          const p = getPokemonById(id);
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
          // Pre-evos introduced later (e.g. Pichu for Pikachu) don't exist
          // in older games either.
          if (!evo?.evolvesFrom || evo.evolvesFrom > game.dexLimit) return null;
          const p = getPokemonById(evo.evolvesFrom);
          return { id: evo.evolvesFrom, name: p ? pokemonName(p, lang) : `#${evo.evolvesFrom}` };
        })(),
      };
    }),
  }));

  // Encounter order = the position in routes.json, NOT the route id. Ids are
  // frozen forever while the array order is the display order and gets
  // reshuffled (FireRed's list was reordered), so sorting by id replays
  // whatever order the pack happened to have when the ids were handed out.
  // Routes no longer in the pack sort last rather than to the front.
  const routeOrder = new Map(getRoutes(gameId).map((r, i) => [r.id, i]));
  views.sort((a, b) => {
    if (a.status !== b.status) return a.status === "DEAD" ? 1 : -1;
    return (
      (routeOrder.get(a.routeId) ?? Number.MAX_SAFE_INTEGER) -
      (routeOrder.get(b.routeId) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  const heading = translations[lang].nav.links;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{heading}</h2>
      <SpriteSetProvider spriteSet={game.spriteSet}>
        <PlayerNamesProvider names={settings.playerNames} lang={lang}>
          <PokemonDetailProvider
            pokemonList={pokemonList}
            forms={getPokemonForms(game.dexLimit)}
            evolutions={getEvolutions(evoOptions)}
            moveData={{ movesets: getMoveset(game.versionGroup), moves: getMoves(lang) }}
            moveTypeHistory={getMoveTypeHistory()}
            effectiveness={getEffectiveness(game.generation)}
            generation={game.generation}
            dexLimit={game.dexLimit}
            lang={lang}
          >
            <LinksView runId={runId} mode={mode} lang={lang} soulLinks={views} />
          </PokemonDetailProvider>
        </PlayerNamesProvider>
      </SpriteSetProvider>
    </div>
  );
}
