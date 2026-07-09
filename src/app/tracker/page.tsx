import { redirect } from "next/navigation";
import { getRoutes, getPokemonList } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { TrackerView } from "@/components/TrackerView";

// Shared, constantly-mutated state (two players editing concurrently) - never
// serve a build-time snapshot, always hit the DB fresh.
export const dynamic = "force-dynamic";

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/tracker?run=${runId}`);

  const routes = getRoutes();
  const pokemonList = getPokemonList();
  const encounters = await prisma.encounter.findMany({ where: { runId } });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Tracker</h2>
      <TrackerView
        runId={runId}
        routes={routes}
        pokemonList={pokemonList}
        encounters={encounters}
      />
    </div>
  );
}
