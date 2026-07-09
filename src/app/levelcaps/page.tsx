import { redirect } from "next/navigation";
import { getLevelCaps } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { LevelCapsView } from "@/components/LevelCapsView";

export const dynamic = "force-dynamic";

export default async function LevelCapsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/levelcaps?run=${runId}`);

  const levelCaps = getLevelCaps();
  const progress = await prisma.levelCapProgress.findMany({ where: { runId } });
  const defeatedIds = new Set(progress.filter((p) => p.defeated).map((p) => p.levelCapId));

  const items = levelCaps.map((cap) => ({ ...cap, defeated: defeatedIds.has(cap.id) }));

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Level Caps</h2>
      <LevelCapsView runId={runId} levelCaps={items} />
    </div>
  );
}
