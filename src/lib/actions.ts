"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPokemonById, getRouteById, getEvolutionById, getLevelCaps } from "@/lib/data";
import { EncounterStatus, LinkStatus, Player } from "@/generated/prisma/client";

export type SpeciesLockInfo =
  | { locked: false }
  | {
      locked: true;
      routeId: number;
      routeName: string;
      player: Player;
      status: EncounterStatus;
    };

/**
 * Species Clause check: a family_id is locked for BOTH players once any
 * non-static encounter anywhere in this run used it, regardless of outcome
 * (caught, killed, or fled). `exclude` omits the encounter slot currently
 * being edited so re-saving the same route/player doesn't lock against itself.
 */
export async function checkSpeciesLock(
  runId: number,
  pokemonId: number,
  exclude?: { routeId: number; player: Player },
): Promise<SpeciesLockInfo> {
  const pokemon = getPokemonById(pokemonId);
  if (!pokemon) return { locked: false };

  const existing = await prisma.encounter.findFirst({
    where: {
      runId,
      familyId: pokemon.family_id,
      isStatic: false,
      ...(exclude
        ? { NOT: { routeId: exclude.routeId, player: exclude.player } }
        : {}),
    },
  });
  if (!existing) return { locked: false };

  const route = getRouteById(existing.routeId);
  return {
    locked: true,
    routeId: existing.routeId,
    routeName: route?.name ?? `Route #${existing.routeId}`,
    player: existing.player,
    status: existing.status,
  };
}

export type SaveEncounterInput = {
  runId: number;
  routeId: number;
  player: Player;
  pokemonId: number;
  status: EncounterStatus;
  isStatic: boolean;
};

export type SaveEncounterResult =
  | { success: true }
  | { success: false; error: string; lock?: SpeciesLockInfo };

export async function saveEncounter(
  input: SaveEncounterInput,
): Promise<SaveEncounterResult> {
  const { runId, routeId, player, pokemonId, status, isStatic } = input;

  const pokemon = getPokemonById(pokemonId);
  if (!pokemon) {
    return { success: false, error: `Unbekannte Pokémon-ID: ${pokemonId}` };
  }
  if (!getRouteById(routeId)) {
    return { success: false, error: `Unbekannte Routen-ID: ${routeId}` };
  }

  if (!isStatic) {
    const lock = await checkSpeciesLock(runId, pokemonId, { routeId, player });
    if (lock.locked) {
      const playerLabel = lock.player === Player.PLAYER1 ? "Spieler 1" : "Spieler 2";
      return {
        success: false,
        error: `${pokemon.name_de} ist durch die Species Clause gesperrt (bereits von ${playerLabel} auf ${lock.routeName} verwendet).`,
        lock,
      };
    }
  }

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

export type MarkDeadResult = { success: true } | { success: false; error: string };

export async function markDead(runId: number, soulLinkId: number): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: `SoulLink #${soulLinkId} nicht gefunden.` };
  }

  await prisma.$transaction([
    prisma.encounter.updateMany({
      where: { soulLinkId },
      data: { status: EncounterStatus.KILLED },
    }),
    prisma.soulLink.update({
      where: { id: soulLinkId },
      data: { status: LinkStatus.DEAD },
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
    return { success: false, error: `SoulLink #${soulLinkId} nicht gefunden.` };
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

export type EvolveResult = { success: true } | { success: false; error: string };

// Evolution never changes family_id, so it can never violate the Species
// Clause - deliberately does NOT call checkSpeciesLock. It also only ever
// touches currentPokemonId, never pokemonId (what was actually caught on the
// route, which the Tracker tab shows) - so evolving in the Links tab can
// never change what the Tracker tab displays.
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
    return { success: false, error: `Encounter #${encounterId} nicht gefunden.` };
  }
  if (encounter.soulLink?.status === LinkStatus.DEAD) {
    return { success: false, error: "Ein totes Pokémon kann nicht entwickelt werden." };
  }

  const evo = getEvolutionById(encounter.currentPokemonId);
  if (!evo || !evo.evolvesTo.includes(targetPokemonId)) {
    return { success: false, error: "Ungültiges Entwicklungsziel." };
  }
  const target = getPokemonById(targetPokemonId);
  if (!target || target.family_id !== encounter.familyId) {
    return { success: false, error: "Interner Fehler: Familien-Inkonsistenz in evolutions.json." };
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
    return { success: false, error: `Encounter #${encounterId} nicht gefunden.` };
  }
  if (encounter.soulLink?.status === LinkStatus.DEAD) {
    return { success: false, error: "Ein totes Pokémon kann nicht zurückentwickelt werden." };
  }

  const evo = getEvolutionById(encounter.currentPokemonId);
  if (!evo?.evolvesFrom) {
    return { success: false, error: "Keine Vorentwicklung vorhanden." };
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
  | { success: false; error: string };

export async function toggleLevelCapDefeated(
  runId: number,
  levelCapId: number,
): Promise<ToggleLevelCapResult> {
  if (!getLevelCaps().some((cap) => cap.id === levelCapId)) {
    return { success: false, error: `Unbekannter Level Cap: ${levelCapId}` };
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

export type CreateRunResult = { success: true; runId: number } | { success: false; error: string };

export async function createRun(name: string): Promise<CreateRunResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, error: "Name darf nicht leer sein." };
  }

  const run = await prisma.run.create({ data: { name: trimmed } });
  revalidatePath("/", "layout");
  return { success: true, runId: run.id };
}

export type DeleteRunResult = { success: true } | { success: false; error: string };

// Cascades to that run's Encounters, SoulLinks, and LevelCapProgress rows
// (onDelete: Cascade on the Run relation) - the UI is responsible for
// confirming with the user before calling this, since it's unrecoverable.
export async function deleteRun(runId: number): Promise<DeleteRunResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: `Run #${runId} nicht gefunden.` };
  }

  await prisma.run.delete({ where: { id: runId } });
  revalidatePath("/", "layout");
  return { success: true };
}
