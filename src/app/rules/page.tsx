import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getGameOrDefault } from "@/lib/data";
import { getLang } from "@/lib/i18n/getLang";
import { DEFAULT_RULES } from "@/lib/defaultRules";
import { RulesView } from "@/components/RulesView";
import { CanonicalRun } from "@/components/CanonicalRun";
import { IS_PUBLIC_INSTANCE } from "@/lib/instance";
import { RunLanding } from "@/components/RunLanding";

export const dynamic = "force-dynamic";

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const resolvedRun = await resolveRunId(run);
  if (!resolvedRun) return <RunLanding />;
  const { runId, runKey, version, mode, players, gameId, settings } = resolvedRun;

  const lang = await getLang();

  const runRow = await prisma.run.findUnique({ where: { id: runId } });
  // App-wide, so this is NOT filtered by runId - the same list of saved
  // rulesets is offered in every run. Ordered by name so the dropdown reads
  // like a list rather than by creation accident. A public instance has no
  // presets: app-wide there means everybody's.
  const presets = IS_PUBLIC_INSTANCE
    ? []
    : await prisma.rulePreset.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
  const defaultMarkdown = DEFAULT_RULES[lang];
  // Pre-existing runs (created before the rules feature) have '' - show the
  // built-in ruleset for them instead of an empty page.
  const markdown = runRow?.rulesMarkdown.trim() ? runRow.rulesMarkdown : defaultMarkdown;

  return (
    <>
      <CanonicalRun runKey={runKey} version={version} />
      <RulesView
        runKey={runKey}
        lang={lang}
        mode={mode}
        players={players}
        markdown={markdown}
        defaultMarkdown={defaultMarkdown}
        settings={settings}
        presets={presets}
        fusionEnabled={Boolean(getGameOrDefault(gameId).fusion)}
      />
    </>
  );
}
