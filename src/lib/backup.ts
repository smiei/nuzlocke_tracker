import { zipSync } from "fflate";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// The types + parseBackup() live in backupParse.ts (no Prisma import, so the
// Import dialog can use it client-side to preview a picked file's run names
// before anything is sent to the server); re-exported here so existing
// server-side imports of "@/lib/backup" keep working unchanged.
export * from "@/lib/backupParse";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupFile, type BackupRun } from "@/lib/backupParse";

const BACKUP_INCLUDE = {
  soulLinks: true,
  encounters: true,
  levelCapProgress: true,
  customRoutes: true,
  routeEntries: true,
} as const;

type RunWithRelations = Prisma.RunGetPayload<{ include: typeof BACKUP_INCLUDE }>;

function runToBackupRun(run: RunWithRelations): BackupRun {
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
      soulLinkRouteId: e.soulLinkId !== null ? routeBySoulLinkId.get(e.soulLinkId) ?? null : null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    levelCapProgress: run.levelCapProgress.map((lc) => ({
      levelCapId: lc.levelCapId,
      defeated: lc.defeated,
      updatedAt: lc.updatedAt.toISOString(),
    })),
    customRoutes: run.customRoutes.map((cr) => ({
      routeId: cr.routeId,
      name: cr.name,
      type: cr.type,
      afterRouteId: cr.afterRouteId,
      hidden: cr.hidden,
      createdAt: cr.createdAt.toISOString(),
    })),
    routeEntries: run.routeEntries.map((re) => ({
      routeId: re.routeId,
      seenAt: re.seenAt.toISOString(),
    })),
  };
}

export async function buildBackup(runIds?: number[]): Promise<BackupFile> {
  const runs = await prisma.run.findMany({
    where: runIds ? { id: { in: runIds } } : undefined,
    orderBy: { createdAt: "asc" },
    include: BACKUP_INCLUDE,
  });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    runs: runs.map(runToBackupRun),
  };
}

// "Alle Runs sichern": one BackupFile-shaped JSON per run, zipped together,
// instead of one combined JSON - each entry is independently importable
// (matches the shape a single-run export already produces) and large
// collections of runs no longer live in one unwieldy file.
export async function buildBackupZip(): Promise<{ filename: string; data: Uint8Array }> {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "asc" },
    include: BACKUP_INCLUDE,
  });

  const usedNames = new Set<string>();
  const files: Record<string, Uint8Array> = {};
  for (const run of runs) {
    const backup: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      runs: [runToBackupRun(run)],
    };
    let name = backupFilename(run.name);
    let suffix = 2;
    while (usedNames.has(name)) {
      name = backupFilename(`${run.name}-${suffix}`);
      suffix++;
    }
    usedNames.add(name);
    files[name] = new TextEncoder().encode(JSON.stringify(backup, null, 2));
  }

  return { filename: backupFilename("all-runs", "zip"), data: zipSync(files) };
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

        // Before the encounters, so their negative routeIds resolve to a
        // route that exists in the restored run.
        for (const cr of run.customRoutes) {
          await tx.customRoute.create({
            data: {
              runId: createdRun.id,
              routeId: cr.routeId,
              name: cr.name,
              type: cr.type,
              afterRouteId: cr.afterRouteId,
              hidden: cr.hidden,
              createdAt: new Date(cr.createdAt),
            },
          });
        }

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

        for (const re of run.routeEntries) {
          await tx.routeEntry.create({
            data: {
              runId: createdRun.id,
              routeId: re.routeId,
              seenAt: new Date(re.seenAt),
            },
          });
        }
      }
    },
    { timeout: 30000, maxWait: 10000 },
  );
  return backup.runs.length;
}

export function backupFilename(runLabel: string, ext: "json" | "zip" = "json"): string {
  const slug =
    runLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "run";
  const date = new Date().toISOString().slice(0, 10);
  return `nuzlocke-${slug}-${date}.${ext}`;
}
