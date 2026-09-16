import { prisma } from "@/lib/prisma";
import type { Player, Run, RunMode } from "@/generated/prisma/client";
import { parseRunSettings, type RunSettings } from "@/lib/runSettings";
import { runPlayers } from "@/lib/players";

export type ResolvedRun = {
  runId: number;
  mode: RunMode;
  // Who plays this run, in order - see src/lib/players.ts.
  players: Player[];
  gameId: string;
  settings: RunSettings;
  canonical: boolean;
};

function resolved(run: Run, canonical: boolean): ResolvedRun {
  return {
    runId: run.id,
    mode: run.mode,
    players: runPlayers(run.mode, run.playerCount),
    gameId: run.gameId,
    settings: parseRunSettings(run.settingsJson),
    canonical,
  };
}

// Which run is "current" is pure navigation state (a ?run= query param), not
// a DB flag - every run stays fully editable whenever it's selected. This
// resolves an incoming (possibly missing/invalid) query value to a concrete
// run id, falling back to the oldest run (the pre-existing data after the
// runs migration lives there), and self-heals if the DB has zero runs.
// `mode`, `players` and `settings` come back for free - the underlying queries
// already fetch every column - so every run-scoped page gets them without an
// extra query.
export async function resolveRunId(rawRun: string | undefined): Promise<ResolvedRun> {
  const parsed = rawRun ? Number(rawRun) : NaN;
  if (Number.isInteger(parsed)) {
    const exists = await prisma.run.findUnique({ where: { id: parsed } });
    if (exists) return resolved(exists, true);
  }

  const fallback = await prisma.run.findFirst({ orderBy: { createdAt: "asc" } });
  if (fallback) return resolved(fallback, false);

  return resolved(await prisma.run.create({ data: { name: "Run 1" } }), false);
}
