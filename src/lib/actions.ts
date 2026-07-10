"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPokemonById, getRouteById, getEvolutionById, getLevelCaps } from "@/lib/data";
import { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { ActionError } from "@/lib/actionErrors";
import type { BackupFile } from "@/lib/backup";
import { applyBackup, backupFilename, buildBackup, parseBackup } from "@/lib/backup";
import { DEFAULT_RULES } from "@/lib/defaultRules";

export type SaveEncounterInput = {
  runId: number;
  routeId: number;
  player: Player;
  pokemonId: number;
  status: EncounterStatus;
  isStatic: boolean;
};

export type SaveEncounterResult = { success: true } | { success: false; error: ActionError };

export async function saveEncounter(
  input: SaveEncounterInput,
): Promise<SaveEncounterResult> {
  const { runId, routeId, player, pokemonId, status, isStatic } = input;

  const pokemon = getPokemonById(pokemonId);
  if (!pokemon) {
    return { success: false, error: { key: "unknownPokemon", id: pokemonId } };
  }
  if (!getRouteById(routeId)) {
    return { success: false, error: { key: "unknownRoute", id: routeId } };
  }

  if (player === Player.PLAYER2) {
    const run = await prisma.run.findUnique({ where: { id: runId } });
    if (run?.mode === RunMode.CLASSIC) {
      return { success: false, error: { key: "classicNoSecondPlayer" } };
    }
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
        status,
        isStatic,
        soulLinkId,
      },
      update: {
        pokemonId,
        currentPokemonId: pokemonId,
        familyId: pokemon.family_id,
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
  return { success: true };
}

export type MarkDeadResult = { success: true } | { success: false; error: ActionError };

export async function markDead(runId: number, soulLinkId: number): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }

  await prisma.$transaction([
    prisma.encounter.updateMany({
      where: { soulLinkId },
      data: { status: EncounterStatus.KILLED },
    }),
    // A dead link leaves the team automatically (teamPosition -> null).
    prisma.soulLink.update({
      where: { id: soulLinkId },
      data: { status: LinkStatus.DEAD, teamPosition: null },
    }),
  ]);

  revalidatePath("/tracker");
  revalidatePath("/links");
  return { success: true };
}

// Safe/lossless: encounters attached to an ALIVE SoulLink are always CAUGHT
// (the only way an encounter joins a link at all - see saveEncounter above),
// so reverting to CAUGHT is always the correct prior state, no history needed.
export async function markAlive(runId: number, soulLinkId: number): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }

  await prisma.$transaction([
    prisma.encounter.updateMany({
      where: { soulLinkId },
      data: { status: EncounterStatus.CAUGHT },
    }),
    prisma.soulLink.update({
      where: { id: soulLinkId },
      data: { status: LinkStatus.ALIVE },
    }),
  ]);

  revalidatePath("/tracker");
  revalidatePath("/links");
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
  return { success: true };
}

export type ToggleLevelCapResult =
  | { success: true; defeated: boolean }
  | { success: false; error: ActionError };

export async function toggleLevelCapDefeated(
  runId: number,
  levelCapId: number,
): Promise<ToggleLevelCapResult> {
  if (!getLevelCaps().some((cap) => cap.id === levelCapId)) {
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
  return { success: true };
}

export type CreateRunResult =
  | { success: true; runId: number }
  | { success: false; error: ActionError };

export async function createRun(name: string, mode: RunMode): Promise<CreateRunResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: { key: "nameRequired" } };
  }

  // New runs never start with an empty ruleset: inherit from the most recent
  // run, or fall back to the built-in default for the very first one.
  // Ordered by id, not createdAt: rows backfilled by hand-written migrations
  // store createdAt as TEXT while Prisma writes numbers, and SQLite sorts
  // TEXT above all numbers - id is monotonic and immune to that.
  const lastRun = await prisma.run.findFirst({ orderBy: { id: "desc" } });
  const rulesMarkdown = lastRun?.rulesMarkdown.trim() ? lastRun.rulesMarkdown : DEFAULT_RULES;

  const run = await prisma.run.create({ data: { name: trimmed, mode, rulesMarkdown } });
  revalidatePath("/", "layout");
  return { success: true, runId: run.id };
}

export type SaveRulesResult = { success: true } | { success: false; error: ActionError };

export async function saveRules(runId: number, markdown: string): Promise<SaveRulesResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  await prisma.run.update({ where: { id: runId }, data: { rulesMarkdown: markdown } });
  revalidatePath("/rules");
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

  const runCount = await applyBackup(parsed);
  revalidatePath("/", "layout");
  return { success: true, runCount };
}
