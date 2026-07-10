import { redirect } from "next/navigation";
import { getRouteById, getPokemonById, getPokemonList, getEvolutionById } from "@/lib/data";
import { computePokemonRanks } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { routeName, pokemonName } from "@/lib/i18n/localize";
import { LinksView } from "@/components/LinksView";
import type { SoulLinkView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/links?run=${runId}`);

  const lang = await getLang();

  const soulLinks = await prisma.soulLink.findMany({
    where: { runId },
    include: { encounters: true },
  });
  const ranks = computePokemonRanks(getPokemonList());

  const views: SoulLinkView[] = soulLinks.map((link) => ({
    id: link.id,
    routeId: link.routeId,
    routeName: (() => {
      const route = getRouteById(link.routeId);
      return route ? routeName(route, lang) : `Route #${link.routeId}`;
    })(),
    status: link.status,
    teamPosition: link.teamPosition,
    encounters: link.encounters.map((e) => {
      // Links shows the current (possibly evolved) form - pokemonId (what was
      // actually caught) is what the Tracker tab shows and never changes here.
      const pokemon = getPokemonById(e.currentPokemonId);
      const evo = getEvolutionById(e.currentPokemonId);
      return {
        id: e.id,
        player: e.player,
        pokemonId: e.currentPokemonId,
        pokemonName: pokemon ? pokemonName(pokemon, lang) : `#${e.currentPokemonId}`,
        types: pokemon?.types ?? [],
        summe: pokemon?.stats.Summe ?? 0,
        rang: ranks.get(e.currentPokemonId) ?? 0,
        status: e.status,
        isStatic: e.isStatic,
        evolvesTo: (evo?.evolvesTo ?? []).map((id) => {
          const p = getPokemonById(id);
          return { id, name: p ? pokemonName(p, lang) : `#${id}` };
        }),
        evolvesFrom: (() => {
          if (!evo?.evolvesFrom) return null;
          const p = getPokemonById(evo.evolvesFrom);
          return { id: evo.evolvesFrom, name: p ? pokemonName(p, lang) : `#${evo.evolvesFrom}` };
        })(),
      };
    }),
  }));

  views.sort((a, b) => {
    if (a.status !== b.status) return a.status === "DEAD" ? 1 : -1;
    return a.routeId - b.routeId;
  });

  const heading = translations[lang].nav.links;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{heading}</h2>
      <LinksView runId={runId} mode={mode} lang={lang} soulLinks={views} />
    </div>
  );
}
