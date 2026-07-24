import { prisma } from "@/lib/prisma";

// The types + parseBackup() live in backupParse.ts (no Prisma import, so the
// Import dialog can use it client-side to preview a picked file's run names
// before anything is sent to the server); re-exported here so existing
// server-side imports of "@/lib/backup" keep working unchanged.
export * from "@/lib/backupParse";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupFile } from "@/lib/backupParse";

export async function buildBackup(runIds?: number[]): Promise<BackupFile> {
  const runs = await prisma.run.findMany({
    where: runIds ? { id: { in: runIds } } : undefined,
    orderBy: { createdAt: "asc" },
    include: { soulLinks: true, encounters: true, levelCapProgress: true },
  });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    runs: runs.map((run) => {
      const routeBySoulLinkId = new Map(run.soulLinks.map((sl) => [sl.id, sl.routeId]));
      return {
        name: run.name,
        mode: run.mode,
        gameId: run.gameId,
        rulesMarkdown: run.rulesMarkdown,
        settingsJson: run.settingsJson,
        createdAt: run.createdAt.toISOString(),
        soulLinks: run.soulLinks.map((sl) => ({
          routeId: sl.routeId,
          status: sl.status,
          teamPosition: sl.teamPosition,
          deathPlayer: sl.deathPlayer,
          deathCause: sl.deathCause,
          createdAt: sl.createdAt.toISOString(),
          updatedAt: sl.updatedAt.toISOString(),
        })),
        encounters: run.encounters.map((e) => ({
          routeId: e.routeId,
          player: e.player,
          pokemonId: e.pokemonId,
          currentPokemonId: e.currentPokemonId,
          familyId: e.familyId,
          nickname: e.nickname,
          status: e.status,
          isStatic: e.isStatic,
          shiny: e.shiny,
          soulLinkRouteId:
            e.soulLinkId !== null ? routeBySoulLinkId.get(e.soulLinkId) ?? null : null,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        })),
        levelCapProgress: run.levelCapProgress.map((lc) => ({
          levelCapId: lc.levelCapId,
          defeated: lc.defeated,
          updatedAt: lc.updatedAt.toISOString(),
        })),
      };
    }),
  };
}

// Inserts every run in the backup as a NEW run (fresh ids), leaving existing
// runs untouched. updatedAt fields are managed by Prisma (@updatedAt) so they
// aren't restored; createdAt is preserved to keep run/encounter ordering.
export async function applyBackup(backup: BackupFile): Promise<number> {
  await prisma.$transaction(
    async (tx) => {
      for (const run of backup.runs) {
        const createdRun = await tx.run.create({
          data: {
            name: run.name,
            mode: run.mode,
            gameId: run.gameId,
            rulesMarkdown: run.rulesMarkdown,
            settingsJson: run.settingsJson,
            createdAt: new Date(run.createdAt),
          },
        });

        const soulLinkIdByRoute = new Map<number, number>();
        for (const sl of run.soulLinks) {
          const created = await tx.soulLink.create({
            data: {
              runId: createdRun.id,
              routeId: sl.routeId,
              status: sl.status,
              teamPosition: sl.teamPosition,
              deathPlayer: sl.deathPlayer,
              deathCause: sl.deathCause,
              createdAt: new Date(sl.createdAt),
            },
          });
          soulLinkIdByRoute.set(sl.routeId, created.id);
        }

        for (const e of run.encounters) {
          await tx.encounter.create({
            data: {
              runId: createdRun.id,
              routeId: e.routeId,
              player: e.player,
              pokemonId: e.pokemonId,
              currentPokemonId: e.currentPokemonId,
              familyId: e.familyId,
              nickname: e.nickname,
              status: e.status,
              isStatic: e.isStatic,
              shiny: e.shiny,
              soulLinkId:
                e.soulLinkRouteId !== null
                  ? soulLinkIdByRoute.get(e.soulLinkRouteId) ?? null
                  : null,
              createdAt: new Date(e.createdAt),
            },
          });
        }

        for (const lc of run.levelCapProgress) {
          await tx.levelCapProgress.create({
            data: { runId: createdRun.id, levelCapId: lc.levelCapId, defeated: lc.defeated },
          });
        }
      }
    },
    { timeout: 30000, maxWait: 10000 },
  );
  return backup.runs.length;
}

export function backupFilename(runLabel: string): string {
  const slug =
    runLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "run";
  const date = new Date().toISOString().slice(0, 10);
  return `nuzlocke-${slug}-${date}.json`;
}
