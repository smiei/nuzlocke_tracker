import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Player, Run, RunMode } from "@/generated/prisma/client";
import { parseRunSettings, type RunSettings } from "@/lib/runSettings";
import { runPlayers } from "@/lib/players";
import { isRunKeyShaped } from "@/lib/runKey";
import { IS_PUBLIC_INSTANCE } from "@/lib/instance";
import { VISITED_RUNS_COOKIE, parseVisitedRuns } from "@/lib/visitedRuns";

export type ResolvedRun = {
  // For the page's own queries. Never handed to the client for an action -
  // that is what runKey is for.
  runId: number;
  // The run's access key: what `?run=` should carry and what every server
  // action takes (see src/lib/runKey.ts).
  runKey: string;
  // Run.version as rendered - CanonicalRun reports it to the poller.
  version: number;
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
    version: run.version,
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
// run. `canonical` is true only for a key match, i.e. when the URL needs no
// rewrite (CanonicalRun). `mode`, `players` and `settings` come back for free -
// the underlying queries already fetch every column - so every run-scoped page
// gets them without an extra query.
//
// A private instance falls back as far as it can: the key, then a bare
// numeric id (links bookmarked before keys existed), then the oldest run, and
// it self-heals an empty database. It never returns null.
//
// A public instance only ever opens a run somebody holds the key to: the one
// in the URL, else the most recent one this browser has visited (the
// nuzlocke_runs cookie). Otherwise null, and the page shows RunLanding - an
// id or "the oldest run" would hand a stranger somebody else's run.
export async function resolveRunId(rawRun: string | undefined): Promise<ResolvedRun | null> {
  if (isRunKeyShaped(rawRun)) {
    const byKey = await prisma.run.findUnique({ where: { accessKey: rawRun } });
    if (byKey) return resolved(byKey, true);
  }

  if (IS_PUBLIC_INSTANCE) {
    const visited = parseVisitedRuns((await cookies()).get(VISITED_RUNS_COOKIE)?.value);
    if (visited.length === 0) return null;
    const runs = await prisma.run.findMany({ where: { accessKey: { in: visited } } });
    const mostRecent = visited.map((key) => runs.find((run) => run.accessKey === key)).find(Boolean);
    return mostRecent ? resolved(mostRecent, false) : null;
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

// The run switcher's list. A private instance lists every run; a public one
// only the runs this browser has visited, most recent first.
export async function listRunsForHeader(): Promise<Run[]> {
  if (!IS_PUBLIC_INSTANCE) {
    return prisma.run.findMany({ orderBy: { createdAt: "asc" } });
  }
  const visited = parseVisitedRuns((await cookies()).get(VISITED_RUNS_COOKIE)?.value);
  if (visited.length === 0) return [];
  const runs = await prisma.run.findMany({ where: { accessKey: { in: visited } } });
  return visited.flatMap((key) => runs.filter((run) => run.accessKey === key));
}
