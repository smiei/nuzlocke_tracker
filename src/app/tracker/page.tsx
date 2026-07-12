import { redirect } from "next/navigation";
import { getRoutes, getPokemonList } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
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
  const { runId, mode, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/tracker?run=${runId}`);

  const lang = await getLang();
  const routes = getRoutes();
  const pokemonList = getPokemonList();
  const encounters = await prisma.encounter.findMany({ where: { runId } });

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">{translations[lang].tracker.heading}</h2>
      <TrackerView
        runId={runId}
        mode={mode}
        lang={lang}
        settings={settings}
        routes={routes}
        pokemonList={pokemonList}
        encounters={encounters}
      />
    </div>
  );
}
