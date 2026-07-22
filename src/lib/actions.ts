"use server";

import { revalidatePath } from "next/cache";
import { publishChange } from "@/lib/liveBus";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_GAME_ID,
  getGameById,
  getPokemonById,
  getRouteById,
  getEvolutionById,
  getLevelCaps,
} from "@/lib/data";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { ActionError } from "@/lib/actionErrors";
import type { BackupFile } from "@/lib/backup";
import { applyBackup, backupFilename, buildBackup, parseBackup } from "@/lib/backup";
import { DEFAULT_RULES } from "@/lib/defaultRules";
import { parseRunSettings, RUN_SETTING_KEYS, type RunSettings } from "@/lib/runSettings";
import type { Lang } from "@/lib/i18n/dictionary";

export type SaveEncounterInput = {
  runId: number;
  routeId: number;
  player: Player;
  pokemonId: number;
  status: EncounterStatus;
  // undefined = leave the stored nickname untouched (e.g. a status-only
  // update); a string sets it (trimmed, empty -> null); null clears it.
  nickname?: string | null;
};

export type SaveEncounterResult = { success: true } | { success: false; error: ActionError };

export async function saveEncounter(
  input: SaveEncounterInput,
): Promise<SaveEncounterResult> {
  const { runId, routeId, player, pokemonId, status } = input;
  // Normalize once; the in-game nickname limit is 10 characters (enforced in
  // the input too), so cap here as the server-side safety net.
  const nickname =
    input.nickname === undefined
      ? undefined
      : (input.nickname ?? "").trim().slice(0, 10) || null;

  const pokemon = getPokemonById(pokemonId);
  if (!pokemon) {
    return { success: false, error: { key: "unknownPokemon", id: pokemonId } };
  }
  // The run decides which game pack the route id refers to.
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }
  const route = getRouteById(run.gameId, routeId);
  if (!route) {
    return { success: false, error: { key: "unknownRoute", id: routeId } };
  }
  // Whether an encounter is static/gift is a fixed property of the location
  // (routes.json `type`), not a per-catch user choice.
  const isStatic = route.type !== "route";

  if (player === Player.PLAYER2 && run.mode === RunMode.CLASSIC) {
    return { success: false, error: { key: "classicNoSecondPlayer" } };
  }

  // The Species Clause is deliberately NOT enforced here: locked picks save
  // normally, and the Encounter tab derives a purely informational warning
  // client-side from the run's encounters (see EncounterEditor).

  await prisma.$transaction(async (tx) => {
    const existing = await tx.encounter.findUnique({
      where: { runId_routeId_player: { runId, routeId, player } },
    });
    const previousSoulLinkId = existing?.soulLinkId ?? null;

    let soulLinkId: number | null = null;
    if (status === EncounterStatus.CAUGHT) {
      const soulLink = await tx.soulLink.upsert({
        where: { runId_routeId: { runId, routeId } },
        create: { runId, routeId },
        update: {},
      });
      soulLinkId = soulLink.id;
    }

    // currentPokemonId (what the Links tab shows) always resets to match a
    // freshly (re-)declared catch - any prior evolution progress belonged to
    // whatever was caught here before, not to this new pick.
    await tx.encounter.upsert({
      where: { runId_routeId_player: { runId, routeId, player } },
      create: {
        runId,
        routeId,
        player,
        pokemonId,
        currentPokemonId: pokemonId,
        familyId: pokemon.family_id,
        nickname: nickname ?? null,
        status,
        isStatic,
        soulLinkId,
      },
      update: {
        pokemonId,
        currentPokemonId: pokemonId,
        familyId: pokemon.family_id,
        ...(nickname !== undefined && { nickname }),
        status,
        isStatic,
        soulLinkId,
      },
    });

    // Keep the invariant "a SoulLink always has >=1 encounter" so later reads
    // (Links tab) never have to special-case empty links.
    if (previousSoulLinkId !== null && previousSoulLinkId !== soulLinkId) {
      const remaining = await tx.encounter.count({
        where: { soulLinkId: previousSoulLinkId },
      });
      if (remaining === 0) {
        await tx.soulLink.delete({ where: { id: previousSoulLinkId } });
      }
    }
  });

  revalidatePath("/tracker");
  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

export type QuickCatchResult =
  | { success: true; addedToTeam: boolean }
  | { success: false; error: ActionError };

// One-tap "caught it" from the Catchrate tab: records a CAUGHT encounter on
// the given route/player (reusing saveEncounter) and drops the route's link
// into the lowest free team slot (0-5). A full team is not an error - the
// catch stands, it just doesn't get a slot (addedToTeam: false).
export async function quickCatch(
  runId: number,
  routeId: number,
  player: Player,
  pokemonId: number,
): Promise<QuickCatchResult> {
  const saved = await saveEncounter({
    runId,
    routeId,
    player,
    pokemonId,
    status: EncounterStatus.CAUGHT,
  });
  if (!saved.success) return saved;

  const link = await prisma.soulLink.findUnique({
    where: { runId_routeId: { runId, routeId } },
  });
  if (!link) return { success: true, addedToTeam: false };
  if (link.teamPosition !== null) return { success: true, addedToTeam: true };

  const occupied = new Set(
    (
      await prisma.soulLink.findMany({
        where: { runId, teamPosition: { not: null } },
        select: { teamPosition: true },
      })
    ).map((l) => l.teamPosition as number),
  );
  let freeSlot: number | null = null;
  for (let i = 0; i <= 5; i++) {
    if (!occupied.has(i)) {
      freeSlot = i;
      break;
    }
  }
  if (freeSlot === null) return { success: true, addedToTeam: false };

  const assigned = await setTeamSlot(runId, freeSlot, link.id);
  return { success: true, addedToTeam: assigned.success };
}

export type MarkDeadResult = { success: true } | { success: false; error: ActionError };

// deathPlayer (SoulLink only) records whose Pokémon fainted; both die
// together, this is just who lost theirs.
export async function markDead(
  runId: number,
  soulLinkId: number,
  deathPlayer?: Player | null,
): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }

  // Deliberately does NOT touch the encounters' status: the Encounter tab
  // tracks what happened at catch time (stays CAUGHT), while the link's
  // DEAD/ALIVE state lives on the SoulLink alone. A dead link also leaves
  // the team automatically (teamPosition -> null).
  await prisma.soulLink.update({
    where: { id: soulLinkId },
    data: { status: LinkStatus.DEAD, teamPosition: null, deathPlayer: deathPlayer ?? null },
  });

  revalidatePath("/tracker");
  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

export type ClearEncounterResult = { success: true } | { success: false; error: ActionError };

// Undo a mistaken encounter: delete the row and clean up an orphaned SoulLink
// (same invariant as saveEncounter - a link always has >=1 encounter).
export async function clearEncounter(
  runId: number,
  routeId: number,
  player: Player,
): Promise<ClearEncounterResult> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.encounter.findUnique({
      where: { runId_routeId_player: { runId, routeId, player } },
    });
    if (!existing || existing.runId !== runId) return;
    const soulLinkId = existing.soulLinkId;
    await tx.encounter.delete({ where: { id: existing.id } });
    if (soulLinkId !== null) {
      const remaining = await tx.encounter.count({ where: { soulLinkId } });
      if (remaining === 0) await tx.soulLink.delete({ where: { id: soulLinkId } });
    }
  });

  revalidatePath("/tracker");
  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

// Counterpart to markDead - only flips the link's own status back, the
// encounters' catch status was never touched.
export async function markAlive(runId: number, soulLinkId: number): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }

  await prisma.soulLink.update({
    where: { id: soulLinkId },
    data: { status: LinkStatus.ALIVE, deathPlayer: null },
  });

  revalidatePath("/tracker");
  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

export type EvolveResult = { success: true } | { success: false; error: ActionError };

// Evolution never changes family_id, so it can never trigger the Species
// Clause warning. It also only ever touches currentPokemonId, never pokemonId
// (what was actually caught on the route, which the Encounter tab shows) - so
// evolving in the Pokémon tab can never change what the Encounter tab displays.
export async function evolveEncounter(
  runId: number,
  encounterId: number,
  targetPokemonId: number,
): Promise<EvolveResult> {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { soulLink: true },
  });
  if (!encounter || encounter.runId !== runId) {
    return { success: false, error: { key: "encounterNotFound", id: encounterId } };
  }
  if (encounter.soulLink?.status === LinkStatus.DEAD) {
    return { success: false, error: { key: "deadCannotEvolve" } };
  }

  const evo = getEvolutionById(encounter.currentPokemonId);
  if (!evo || !evo.evolvesTo.includes(targetPokemonId)) {
    return { success: false, error: { key: "invalidEvolutionTarget" } };
  }
  const target = getPokemonById(targetPokemonId);
  if (!target || target.family_id !== encounter.familyId) {
    return { success: false, error: { key: "evolutionFamilyMismatch" } };
  }

  await prisma.encounter.update({
    where: { id: encounterId },
    data: { currentPokemonId: targetPokemonId },
  });

  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

export async function revertEvolution(runId: number, encounterId: number): Promise<EvolveResult> {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: { soulLink: true },
  });
  if (!encounter || encounter.runId !== runId) {
    return { success: false, error: { key: "encounterNotFound", id: encounterId } };
  }
  if (encounter.soulLink?.status === LinkStatus.DEAD) {
    return { success: false, error: { key: "deadCannotRevert" } };
  }

  const evo = getEvolutionById(encounter.currentPokemonId);
  if (!evo?.evolvesFrom) {
    return { success: false, error: { key: "noPreEvolution" } };
  }

  await prisma.encounter.update({
    where: { id: encounterId },
    data: { currentPokemonId: evo.evolvesFrom },
  });

  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

export type ToggleLevelCapResult =
  | { success: true; defeated: boolean }
  | { success: false; error: ActionError };

export async function toggleLevelCapDefeated(
  runId: number,
  levelCapId: number,
): Promise<ToggleLevelCapResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }
  if (!getLevelCaps(run.gameId).some((cap) => cap.id === levelCapId)) {
    return { success: false, error: { key: "unknownLevelCap", id: levelCapId } };
  }

  const existing = await prisma.levelCapProgress.findUnique({
    where: { runId_levelCapId: { runId, levelCapId } },
  });
  const nextDefeated = !(existing?.defeated ?? false);

  await prisma.levelCapProgress.upsert({
    where: { runId_levelCapId: { runId, levelCapId } },
    create: { runId, levelCapId, defeated: nextDefeated },
    update: { defeated: nextDefeated },
  });

  revalidatePath("/levelcaps");
  publishChange(runId);
  return { success: true, defeated: nextDefeated };
}

export type SetTeamSlotResult = { success: true } | { success: false; error: ActionError };

// Assigns a link to one of the run's 6 team slots (position 0-5), or clears
// the slot when soulLinkId is null. Enforces both invariants - a slot holds at
// most one link, and a link sits in at most one slot - by vacating the target
// slot and clearing the link's previous slot before assigning, all in one
// transaction so the unique (runId, teamPosition) index is never transiently
// violated.
export async function setTeamSlot(
  runId: number,
  position: number,
  soulLinkId: number | null,
): Promise<SetTeamSlotResult> {
  if (!Number.isInteger(position) || position < 0 || position > 5) {
    return { success: false, error: { key: "invalidTeamSlot" } };
  }

  if (soulLinkId !== null) {
    const link = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
    if (!link || link.runId !== runId) {
      return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.soulLink.updateMany({
      where: { runId, teamPosition: position },
      data: { teamPosition: null },
    });
    if (soulLinkId !== null) {
      await tx.soulLink.update({ where: { id: soulLinkId }, data: { teamPosition: position } });
    }
  });

  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

export type CreateRunResult =
  | { success: true; runId: number }
  | { success: false; error: ActionError };

export async function createRun(
  name: string,
  mode: RunMode,
  sourceRunId?: number | null,
  gameId?: string,
  lang?: Lang,
): Promise<CreateRunResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: { key: "nameRequired" } };
  }
  // Unknown/missing game -> default pack instead of a broken run.
  const game = gameId && getGameById(gameId) ? gameId : DEFAULT_GAME_ID;

  // New runs never start with an empty ruleset: inherit ruleset + rule
  // toggles from the run that was ACTIVE when the user hit "+" (what's
  // currently on screen), falling back to the most recent run, then to the
  // built-in default for the very first one. Fallback ordered by id, not
  // createdAt: rows backfilled by hand-written migrations store createdAt as
  // TEXT while Prisma writes numbers, and SQLite sorts TEXT above all
  // numbers - id is monotonic and immune to that.
  const source =
    (sourceRunId != null
      ? await prisma.run.findUnique({ where: { id: sourceRunId } })
      : null) ?? (await prisma.run.findFirst({ orderBy: { id: "desc" } }));
  const rulesMarkdown = source?.rulesMarkdown.trim()
    ? source.rulesMarkdown
    : DEFAULT_RULES[lang ?? "de"];
  const settingsJson = source?.settingsJson ?? "{}";

  const run = await prisma.run.create({
    data: { name: trimmed, mode, gameId: game, rulesMarkdown, settingsJson },
  });
  revalidatePath("/", "layout");
  publishChange(run.id);
  return { success: true, runId: run.id };
}

export type RenameRunResult = { success: true } | { success: false; error: ActionError };

export async function renameRun(runId: number, name: string): Promise<RenameRunResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: { key: "nameRequired" } };
  }
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  await prisma.run.update({ where: { id: runId }, data: { name: trimmed } });
  revalidatePath("/", "layout");
  publishChange(runId);
  return { success: true };
}

export type UpdateRunSettingsResult = { success: true } | { success: false; error: ActionError };

// Merges the given toggle changes into the run's stored settings. Only known
// keys with boolean values are applied - anything else is ignored, matching
// the tolerant parseRunSettings on the read side.
export async function updateRunSettings(
  runId: number,
  changes: Partial<RunSettings>,
): Promise<UpdateRunSettingsResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  const settings = parseRunSettings(run.settingsJson);
  for (const key of RUN_SETTING_KEYS) {
    const value = changes[key];
    if (typeof value === "boolean") (settings[key] as boolean) = value;
  }
  if (changes.playerNames) {
    settings.playerNames = {
      PLAYER1: (changes.playerNames.PLAYER1 ?? settings.playerNames.PLAYER1).slice(0, 20),
      PLAYER2: (changes.playerNames.PLAYER2 ?? settings.playerNames.PLAYER2).slice(0, 20),
    };
  }

  await prisma.run.update({
    where: { id: runId },
    data: { settingsJson: JSON.stringify(settings) },
  });

  // Toggles affect rendering on several tabs (clause warnings, nicknames,
  // statics filter, evolution methods, player names) - refresh run-scoped.
  revalidatePath("/rules");
  revalidatePath("/tracker");
  revalidatePath("/links");
  revalidatePath("/catchrate");
  revalidatePath("/typen");
  revalidatePath("/weaknesses");
  publishChange(runId);
  return { success: true };
}

export type SaveRulesResult = { success: true } | { success: false; error: ActionError };

export async function saveRules(runId: number, markdown: string): Promise<SaveRulesResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  await prisma.run.update({ where: { id: runId }, data: { rulesMarkdown: markdown } });
  revalidatePath("/rules");
  publishChange(runId);
  return { success: true };
}

export type DeleteRunResult = { success: true } | { success: false; error: ActionError };

// Cascades to that run's Encounters, SoulLinks, and LevelCapProgress rows
// (onDelete: Cascade on the Run relation) - the UI is responsible for
// confirming with the user before calling this, since it's unrecoverable.
export async function deleteRun(runId: number): Promise<DeleteRunResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  await prisma.run.delete({ where: { id: runId } });
  revalidatePath("/", "layout");
  publishChange(runId);
  return { success: true };
}

export type BackupResult =
  | { success: true; backup: BackupFile; filename: string }
  | { success: false; error: ActionError };

export async function exportRunBackup(runId: number): Promise<BackupResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }
  const backup = await buildBackup([runId]);
  return { success: true, backup, filename: backupFilename(run.name) };
}

export async function exportAllBackup(): Promise<BackupResult> {
  const backup = await buildBackup();
  return { success: true, backup, filename: backupFilename("all-runs") };
}

export type ImportBackupResult =
  | { success: true; runCount: number }
  | { success: false; error: ActionError };

// Non-destructive: imported runs are ADDED as new runs, existing data is never
// touched or overwritten.
export async function importBackup(json: string): Promise<ImportBackupResult> {
  const parsed = parseBackup(json);
  if (!parsed) {
    return { success: false, error: { key: "backupInvalid" } };
  }
  if (parsed.runs.length === 0) {
    return { success: false, error: { key: "backupEmpty" } };
  }

  // Catch unexpected failures (e.g. filesystem/permission problems) so the
  // user gets a dialog message instead of a crashed error page.
  let runCount: number;
  try {
    runCount = await applyBackup(parsed);
  } catch (error) {
    console.error("importBackup failed:", error);
    return { success: false, error: { key: "unexpected" } };
  }
  revalidatePath("/", "layout");
  // Imports add whole runs - no single runId; 0 = "anything changed".
  publishChange(0);
  return { success: true, runCount };
}
