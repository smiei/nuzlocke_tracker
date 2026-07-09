import { redirect } from "next/navigation";
import { getRouteById, getPokemonById, getPokemonList, getEvolutionById } from "@/lib/data";
import { computePokemonRanks } from "@/lib/ranking";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { LinksView } from "@/components/LinksView";
import type { SoulLinkView } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/links?run=${runId}`);

  const soulLinks = await prisma.soulLink.findMany({
    where: { runId },
    include: { encounters: true },
  });
  const ranks = computePokemonRanks(getPokemonList());

  const views: SoulLinkView[] = soulLinks.map((link) => ({
    id: link.id,
    routeId: link.routeId,
    routeName: getRouteById(link.routeId)?.name ?? `Route #${link.routeId}`,
    status: link.status,
    encounters: link.encounters.map((e) => {
      // Links shows the current (possibly evolved) form - pokemonId (what was
      // actually caught) is what the Tracker tab shows and never changes here.
      const pokemon = getPokemonById(e.currentPokemonId);
      const evo = getEvolutionById(e.currentPokemonId);
      return {
        id: e.id,
        player: e.player,
        pokemonId: e.currentPokemonId,
        pokemonName: pokemon?.name_de ?? `#${e.currentPokemonId}`,
        types: pokemon?.types ?? [],
        summe: pokemon?.stats.Summe ?? 0,
        rang: ranks.get(e.currentPokemonId) ?? 0,
        status: e.status,
        isStatic: e.isStatic,
        evolvesTo: (evo?.evolvesTo ?? []).map((id) => ({
          id,
          name: getPokemonById(id)?.name_de ?? `#${id}`,
        })),
        evolvesFrom: evo?.evolvesFrom
          ? { id: evo.evolvesFrom, name: getPokemonById(evo.evolvesFrom)?.name_de ?? `#${evo.evolvesFrom}` }
          : null,
      };
    }),
  }));

  views.sort((a, b) => {
    if (a.status !== b.status) return a.status === "DEAD" ? 1 : -1;
    return a.routeId - b.routeId;
  });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Links</h2>
      <LinksView runId={runId} soulLinks={views} />
    </div>
  );
}
