import { redirect } from "next/navigation";
import { resolveRunId } from "@/lib/runs";

// The Catchrate tab was folded into the combined "Kampf & Fang" tab (/typen):
// enter a Pokémon once, then switch between the Wild (catch) and Trainer
// (battle) views. Keep this route as a redirect so old bookmarks still land on
// the current run's combined tab.
export const dynamic = "force-dynamic";

export default async function CatchratePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId } = await resolveRunId(run);
  redirect(`/typen?run=${runId}`);
}
