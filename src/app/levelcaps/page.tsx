import { redirect } from "next/navigation";
import { getGameOrDefault, getLevelCaps } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { computeLevelCapProgress } from "@/lib/progress";
import { LevelCapsView } from "@/components/LevelCapsView";
import { ProgressBar } from "@/components/ProgressBar";

export const dynamic = "force-dynamic";

export default async function LevelCapsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, gameId, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/levelcaps?run=${runId}`);

  const lang = await getLang();
  const t = translations[lang].levelcaps;
  const game = getGameOrDefault(gameId);
  const trainerSet = game.trainerSet ?? game.id;
  const levelCaps = getLevelCaps(gameId);
  const progressRows = await prisma.levelCapProgress.findMany({ where: { runId } });
  const defeatedIds = new Set(progressRows.filter((p) => p.defeated).map((p) => p.levelCapId));

  const items = levelCaps.map((cap) => ({ ...cap, defeated: defeatedIds.has(cap.id) }));
  const progress = computeLevelCapProgress(items);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t.heading}</h2>
        <ProgressBar
          done={progress.done}
          total={progress.total}
          percent={progress.percent}
          title={t.progressTitle(progress.done, progress.total, progress.percent)}
        />
      </div>
      <LevelCapsView runId={runId} lang={lang} levelCaps={items} trainerSet={trainerSet} />
    </div>
  );
}
