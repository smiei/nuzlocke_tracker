import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/enums";
import { clampPlayerCount } from "@/lib/players";

// Client-safe half of the backup format: types + parsing only, no Prisma
// client import (unlike backup.ts, which needs the DB for buildBackup/
// applyBackup) - lets the Import dialog validate a picked file and preview
// its run names in the browser before anything is sent to the server.
//
// Backup files are plain JSON. IDs are deliberately NOT exported: on import
// every row gets a fresh autoincrement id, so a backup can always be restored
// alongside existing runs without primary-key collisions. The only in-file
// relationship that matters (Encounter -> SoulLink) is expressed via the
// SoulLink's routeId, which is unique per run and stable across a round-trip.
export const BACKUP_FORMAT = "nuzlocke-tracker-backup";
// 2 added `customRoutes` and `routeEntries`. 3 added `deathLevelCapId`/
// `diedAt` on SoulLink (missing before, so a restore lost the Memorial's
// chronological order) and `fusedInto` on Encounter (Infinite Fusion - see
// CLAUDE.md). A v1/v2 file still imports - the new fields default to null/
// empty - and importBackup() warns when a file's OWN version is newer than
// this constant (an older build reading a newer backup would silently drop
// fields it doesn't know about, fusions included). 4 added `boundToRouteId` on
// SoulLink (a split-off wild fusion body's link bound to its route's link),
// `playerCount` on the run and PLAYER3/PLAYER4 encounters - an older build
// would read a four-player run as two players plus stray Player-1 rows.
export const BACKUP_VERSION = 4;

export type BackupSoulLink = {
  routeId: number;
  status: LinkStatus;
  teamPosition: number | null;
  deathPlayer: Player | null;
  deathCause: string | null;
  // Added in v3; null in an older file (no death point was ever recorded, or
  // it predates death-point tracking - the two look the same on import,
  // which just means it parks at the top of the Memorial until edited).
  deathLevelCapId: number | null;
  diedAt: string | null;
  // Added in v4: the routeId of the link this one is bound to (SoulLink
  // .boundToId), which like soulLinkRouteId is unique per run and needs no
  // id. null = not bound, and in every older file. Resolved in a second pass
  // on import, once every link exists.
  boundToRouteId: number | null;
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
  shiny: boolean;
  // routeId of the SoulLink this encounter belongs to, or null if unlinked.
  soulLinkRouteId: number | null;
  // Added in v3 (Infinite Fusion): identifies this fusion's HOST by
  // (routeId, player) rather than by id - ids aren't exported, see the file
  // header. null = not a fusion donor. Resolved in a SECOND pass on import,
  // after every encounter has a fresh id (applyBackup in backup.ts).
  fusedInto: { routeId: number; player: Player } | null;
  // Added in v3: this encounter is the body of a fusion that was CAUGHT as
  // one (see setEncounterBody), which is what makes clearing the head take it
  // along. Missing/false in older files, and on every self-made fusion.
  isFusionBody: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BackupLevelCapProgress = {
  levelCapId: number;
  defeated: boolean;
  updatedAt: string;
};

export type BackupCustomRoute = {
  // The negative id this route is exposed under. Restored verbatim, which is
  // what keeps every Encounter/SoulLink routeId in the same file pointing at
  // the right thing.
  routeId: number;
  name: string;
  type: string;
  afterRouteId: number | null;
  // A free-team slot rather than a place the run visits. Absent in a backup
  // written before free teams existed, where `false` is the right answer
  // anyway - every custom route back then was a real location.
  hidden: boolean;
  createdAt: string;
};

export type BackupRouteEntry = {
  routeId: number;
  seenAt: string;
};

export type BackupRun = {
  name: string;
  mode: RunMode;
  // Added in v4: SoulLink players (2-4). Absent in older files, which were
  // all two-player runs.
  playerCount: number;
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
  // Added in v2; absent in older files.
  customRoutes: BackupCustomRoute[];
  routeEntries: BackupRouteEntry[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  runs: BackupRun[];
};

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

// Unlike isoString(), a missing value here is a real "not recorded" state,
// not a fallback timestamp - used for diedAt.
function isoStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function fusedIntoRef(value: unknown): { routeId: number; player: Player } | null {
  if (!isRecord(value)) return null;
  if (typeof value.routeId !== "number" || !isEnumValue(Player, value.player)) return null;
  return { routeId: value.routeId, player: value.player };
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
      playerCount: clampPlayerCount(rawRun.playerCount),
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
            deathPlayer: isEnumValue(Player, sl.deathPlayer) ? sl.deathPlayer : null,
            deathCause: typeof sl.deathCause === "string" ? sl.deathCause : null,
            deathLevelCapId: typeof sl.deathLevelCapId === "number" ? sl.deathLevelCapId : null,
            diedAt: isoStringOrNull(sl.diedAt),
            boundToRouteId: typeof sl.boundToRouteId === "number" ? sl.boundToRouteId : null,
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
            shiny: e.shiny === true,
            soulLinkRouteId:
              typeof e.soulLinkRouteId === "number" ? e.soulLinkRouteId : null,
            fusedInto: fusedIntoRef(e.fusedInto),
            isFusionBody: e.isFusionBody === true,
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
      customRoutes: Array.isArray(rawRun.customRoutes)
        ? rawRun.customRoutes
            .filter(isRecord)
            // A custom route id is always negative; anything else in this
            // array would collide with the game pack's own ids.
            .filter((cr) => typeof cr.routeId === "number" && cr.routeId < 0)
            .map((cr) => ({
              routeId: num(cr.routeId),
              name: typeof cr.name === "string" && cr.name.trim() ? cr.name : "Route",
              type: cr.type === "static" ? "static" : "route",
              afterRouteId: typeof cr.afterRouteId === "number" ? cr.afterRouteId : null,
              hidden: cr.hidden === true,
              createdAt: isoString(cr.createdAt),
            }))
        : [],
      routeEntries: Array.isArray(rawRun.routeEntries)
        ? rawRun.routeEntries.filter(isRecord).map((re) => ({
            routeId: num(re.routeId),
            seenAt: isoString(re.seenAt),
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
