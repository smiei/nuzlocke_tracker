import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { DEFAULT_RULES } from "@/lib/defaultRules";
import { RulesView } from "@/components/RulesView";

export const dynamic = "force-dynamic";

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/rules?run=${runId}`);

  const lang = await getLang();

  const runRow = await prisma.run.findUnique({ where: { id: runId } });
  // Pre-existing runs (created before the rules feature) have '' - show the
  // built-in ruleset for them instead of an empty page.
  const markdown = runRow?.rulesMarkdown.trim() ? runRow.rulesMarkdown : DEFAULT_RULES;

  return (
    <RulesView runId={runId} lang={lang} mode={mode} markdown={markdown} settings={settings} />
  );
}
