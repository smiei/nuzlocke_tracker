import { prisma } from "@/lib/prisma";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";

// Backup files are plain JSON. IDs are deliberately NOT exported: on import
// every row gets a fresh autoincrement id, so a backup can always be restored
// alongside existing runs without primary-key collisions. The only in-file
// relationship that matters (Encounter -> SoulLink) is expressed via the
// SoulLink's routeId, which is unique per run and stable across a round-trip.
export const BACKUP_FORMAT = "nuzlocke-tracker-backup";
export const BACKUP_VERSION = 1;

export type BackupSoulLink = {
  routeId: number;
  status: LinkStatus;
  teamPosition: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupEncounter = {
  routeId: number;
  player: Player;
  pokemonId: number;
  currentPokemonId: number;
  familyId: number;
  nickname: string | null;
  status: EncounterStatus;
  isStatic: boolean;
  // routeId of the SoulLink this encounter belongs to, or null if unlinked.
  soulLinkRouteId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupLevelCapProgress = {
  levelCapId: number;
  defeated: boolean;
  updatedAt: string;
};

export type BackupRun = {
  name: string;
  mode: RunMode;
  // Game data pack the run plays (data/games/<gameId>/). Old backups
  // without it restore as "firered" (the only game that existed back then).
  gameId: string;
  rulesMarkdown: string;
  // Raw Run.settingsJson - kept as the stored string; parsing/defaulting
  // happens at read time via parseRunSettings, so old backups without it
  // simply restore as '{}' (= all defaults).
  settingsJson: string;
  createdAt: string;
  soulLinks: BackupSoulLink[];
  encounters: BackupEncounter[];
  levelCapProgress: BackupLevelCapProgress[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  runs: BackupRun[];
};

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends Record<string, string>>(
  enumObj: T,
  value: unknown,
): value is T[keyof T] {
  return typeof value === "string" && (Object.values(enumObj) as string[]).includes(value);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isoString(value: unknown): string {
  return typeof value === "string" ? value : new Date().toISOString();
}

// Lenient by design: a valid envelope with unexpected extras still imports;
// only a wrong `format` marker or non-array `runs` rejects the whole file.
// Individual rows fall back to safe defaults rather than aborting the import.
export function parseBackup(json: string): BackupFile | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT || !Array.isArray(data.runs)) {
    return null;
  }

  const runs: BackupRun[] = [];
  for (const rawRun of data.runs) {
    if (!isRecord(rawRun)) continue;
    runs.push({
      name: typeof rawRun.name === "string" ? rawRun.name : "Imported Run",
      mode: isEnumValue(RunMode, rawRun.mode) ? rawRun.mode : RunMode.SOULLINK,
      gameId: typeof rawRun.gameId === "string" && rawRun.gameId ? rawRun.gameId : "firered",
      rulesMarkdown: typeof rawRun.rulesMarkdown === "string" ? rawRun.rulesMarkdown : "",
      settingsJson: typeof rawRun.settingsJson === "string" ? rawRun.settingsJson : "{}",
      createdAt: isoString(rawRun.createdAt),
      soulLinks: Array.isArray(rawRun.soulLinks)
        ? rawRun.soulLinks.filter(isRecord).map((sl) => ({
            routeId: num(sl.routeId),
            status: isEnumValue(LinkStatus, sl.status) ? sl.status : LinkStatus.ALIVE,
            teamPosition:
              typeof sl.teamPosition === "number" && sl.teamPosition >= 0 && sl.teamPosition <= 5
                ? sl.teamPosition
                : null,
            createdAt: isoString(sl.createdAt),
            updatedAt: isoString(sl.updatedAt),
          }))
        : [],
      encounters: Array.isArray(rawRun.encounters)
        ? rawRun.encounters.filter(isRecord).map((e) => ({
            routeId: num(e.routeId),
            player: isEnumValue(Player, e.player) ? e.player : Player.PLAYER1,
            pokemonId: num(e.pokemonId),
            currentPokemonId: num(e.currentPokemonId, num(e.pokemonId)),
            familyId: num(e.familyId),
            nickname: typeof e.nickname === "string" && e.nickname.trim() ? e.nickname : null,
            status: isEnumValue(EncounterStatus, e.status) ? e.status : EncounterStatus.CAUGHT,
            isStatic: e.isStatic === true,
            soulLinkRouteId:
              typeof e.soulLinkRouteId === "number" ? e.soulLinkRouteId : null,
            createdAt: isoString(e.createdAt),
            updatedAt: isoString(e.updatedAt),
          }))
        : [],
      levelCapProgress: Array.isArray(rawRun.levelCapProgress)
        ? rawRun.levelCapProgress.filter(isRecord).map((lc) => ({
            levelCapId: num(lc.levelCapId),
            defeated: lc.defeated === true,
            updatedAt: isoString(lc.updatedAt),
          }))
        : [],
    });
  }
  return {
    format: BACKUP_FORMAT,
    version: num(data.version, BACKUP_VERSION),
    exportedAt: isoString(data.exportedAt),
    runs,
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
