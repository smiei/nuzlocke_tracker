import { getGameOrDefault, getLevelCaps } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { translations } from "@/lib/i18n/dictionary";
import { computeLevelCapProgress, eliteFourIndex } from "@/lib/progress";
import { LevelCapsView } from "@/components/LevelCapsView";
import { CanonicalRun } from "@/components/CanonicalRun";
import { ProgressBar } from "@/components/ProgressBar";
import { PageHeader } from "@/components/ui/Page";

export const dynamic = "force-dynamic";

export default async function LevelCapsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, gameId } = await resolveRunId(run);

  const lang = await getLang();
  const t = translations[lang].levelcaps;
  const game = getGameOrDefault(gameId);
  const trainerSet = game.trainerSet ?? game.id;
  const levelCaps = getLevelCaps(gameId);
  const progressRows = await prisma.levelCapProgress.findMany({ where: { runId } });
  const defeatedIds = new Set(progressRows.filter((p) => p.defeated).map((p) => p.levelCapId));

  const items = levelCaps.map((cap) => ({ ...cap, defeated: defeatedIds.has(cap.id) }));
  const progress = computeLevelCapProgress(items);
  const markerAt = eliteFourIndex(items);

  return (
    <div>
      <CanonicalRun runId={runId} />
      <PageHeader title={t.heading}>
        <ProgressBar
          done={progress.done}
          total={progress.total}
          percent={progress.percent}
          title={t.progressTitle(progress.done, progress.total, progress.percent)}
          markerAt={markerAt ?? undefined}
          markerTitle={t.eliteFourMarker}
        />
      </PageHeader>
      <LevelCapsView runId={runId} lang={lang} levelCaps={items} trainerSet={trainerSet} />
    </div>
  );
}
