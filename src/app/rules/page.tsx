import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { DEFAULT_RULES } from "@/lib/defaultRules";
import { RulesView } from "@/components/RulesView";
import { CanonicalRun } from "@/components/CanonicalRun";

export const dynamic = "force-dynamic";

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, settings } = await resolveRunId(run);

  const lang = await getLang();

  const runRow = await prisma.run.findUnique({ where: { id: runId } });
  // App-wide, so this is NOT filtered by runId - the same list of saved
  // rulesets is offered in every run. Ordered by name so the dropdown reads
  // like a list rather than by creation accident.
  const presets = await prisma.rulePreset.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const defaultMarkdown = DEFAULT_RULES[lang];
  // Pre-existing runs (created before the rules feature) have '' - show the
  // built-in ruleset for them instead of an empty page.
  const markdown = runRow?.rulesMarkdown.trim() ? runRow.rulesMarkdown : defaultMarkdown;

  return (
    <>
      <CanonicalRun runId={runId} />
      <RulesView
        runId={runId}
        lang={lang}
        mode={mode}
        markdown={markdown}
        defaultMarkdown={defaultMarkdown}
        settings={settings}
        presets={presets}
      />
    </>
  );
}
