import { redirect } from "next/navigation";
import { getCatchRates, getPokemonList } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { CatchRateView } from "@/components/CatchRateView";

export const dynamic = "force-dynamic";

export default async function CatchratePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/catchrate?run=${runId}`);

  const catchRates = Object.fromEntries(
    getCatchRates().map((entry) => [entry.id, entry.catch_rate]),
  );

  // Families already used by ANY encounter in this run (static or not) are
  // locked by the Species Clause - the calculator only warns, never blocks.
  // With the clause rule off, nothing is marked at all.
  const used = settings.speciesClause
    ? await prisma.encounter.findMany({
        where: { runId },
        select: { familyId: true },
      })
    : [];
  const lockedFamilyIds = [...new Set(used.map((e) => e.familyId))];

  return (
    <CatchRateView
      pokemonList={getPokemonList()}
      catchRates={catchRates}
      lockedFamilyIds={lockedFamilyIds}
    />
  );
}
