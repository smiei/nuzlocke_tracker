import { prisma } from "@/lib/prisma";
import type { Player, Run, RunMode } from "@/generated/prisma/client";
import { parseRunSettings, type RunSettings } from "@/lib/runSettings";
import { runPlayers } from "@/lib/players";
import { isRunKeyShaped } from "@/lib/runKey";

export type ResolvedRun = {
  // For the page's own queries. Never handed to the client for an action -
  // that is what runKey is for.
  runId: number;
  // The run's access key: what `?run=` should carry and what every server
  // action takes (see src/lib/runKey.ts).
  runKey: string;
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
    runKey: run.accessKey,
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
// run: its access key, then a bare numeric id (links bookmarked before keys
// existed - CanonicalRun rewrites those to the key), falling back to the
// oldest run, and self-heals if the DB has zero runs. `canonical` is true only
// for a key match, i.e. when the URL needs no rewrite.
// `mode`, `players` and `settings` come back for free - the underlying queries
// already fetch every column - so every run-scoped page gets them without an
// extra query.
export async function resolveRunId(rawRun: string | undefined): Promise<ResolvedRun> {
  if (isRunKeyShaped(rawRun)) {
    const byKey = await prisma.run.findUnique({ where: { accessKey: rawRun } });
    if (byKey) return resolved(byKey, true);
  }
  // At most 9 digits: anything longer cannot be a run id and would overflow
  // Prisma's Int before the lookup could simply miss.
  if (rawRun && /^\d{1,9}$/.test(rawRun)) {
    const byId = await prisma.run.findUnique({ where: { id: Number(rawRun) } });
    if (byId) return resolved(byId, false);
  }

  const fallback = await prisma.run.findFirst({ orderBy: { createdAt: "asc" } });
  if (fallback) return resolved(fallback, false);

  return resolved(await prisma.run.create({ data: { name: "Run 1" } }), false);
}
