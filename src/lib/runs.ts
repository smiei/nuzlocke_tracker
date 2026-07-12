import { prisma } from "@/lib/prisma";
import type { RunMode } from "@/generated/prisma/client";
import { parseRunSettings, type RunSettings } from "@/lib/runSettings";

// Which run is "current" is pure navigation state (a ?run= query param), not
// a DB flag - every run stays fully editable whenever it's selected. This
// resolves an incoming (possibly missing/invalid) query value to a concrete
// run id, falling back to the oldest run (the pre-existing data after the
// runs migration lives there), and self-heals if the DB has zero runs.
// `mode` and `settings` come back for free - the underlying queries already
// fetch every column - so every run-scoped page gets them without an extra
// query.
export async function resolveRunId(
  rawRun: string | undefined,
): Promise<{ runId: number; mode: RunMode; settings: RunSettings; canonical: boolean }> {
  const parsed = rawRun ? Number(rawRun) : NaN;
  if (Number.isInteger(parsed)) {
    const exists = await prisma.run.findUnique({ where: { id: parsed } });
    if (exists) {
      return {
        runId: exists.id,
        mode: exists.mode,
        settings: parseRunSettings(exists.settingsJson),
        canonical: true,
      };
    }
  }

  const fallback = await prisma.run.findFirst({ orderBy: { createdAt: "asc" } });
  if (fallback) {
    return {
      runId: fallback.id,
      mode: fallback.mode,
      settings: parseRunSettings(fallback.settingsJson),
      canonical: false,
    };
  }

  const created = await prisma.run.create({ data: { name: "Run 1" } });
  return {
    runId: created.id,
    mode: created.mode,
    settings: parseRunSettings(created.settingsJson),
    canonical: false,
  };
}
