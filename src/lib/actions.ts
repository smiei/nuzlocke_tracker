"use server";

import { revalidatePath } from "next/cache";
import { publishChange } from "@/lib/liveBus";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_GAME_ID,
  getGameById,
  getPokemonById,
  getEvolutionById,
  getLevelCaps,
} from "@/lib/data";
import { EncounterStatus, LinkStatus, Player, RunMode, type Prisma } from "@/generated/prisma/client";
import { getRouteForRun, getRoutesForRun, nextCustomRouteId } from "@/lib/runRoutes";
import { CUSTOM_ROUTE_NAME_MAX, isCustomRouteId } from "@/lib/customRoutes";
import { groupSoulLinks, teamSlotsNeeded } from "@/lib/fusionGroups";
import { localizeName } from "@/lib/i18n/localize";
import type { ActionError } from "@/lib/actionErrors";
import type { BackupFile } from "@/lib/backup";
import { applyBackup, backupFilename, buildBackup, buildBackupZip, parseBackup } from "@/lib/backup";
import { DEFAULT_RULES } from "@/lib/defaultRules";
import {
  PRESET_NAME_MAX,
  parseRunSettings,
  serializePresetSettings,
  RUN_SETTING_KEYS,
  type RunSettings,
} from "@/lib/runSettings";
import type { Lang } from "@/lib/i18n/dictionary";

// The tabs whose rendering depends on the run's route list or rule toggles.
// Spelled out once instead of at each call site, which is how the list drifted
// before.
function revalidateRunViews() {
  revalidatePath("/rules");
  revalidatePath("/tracker");
  revalidatePath("/links");
  revalidatePath("/typen");
  revalidatePath("/overview");
}

export type SaveEncounterInput = {
  runId: number;
  routeId: number;
  player: Player;
  pokemonId: number;
  status: EncounterStatus;
  // undefined = leave the stored nickname untouched (e.g. a status-only
  // update); a string sets it (trimmed, empty -> null); null clears it.
  nickname?: string | null;
  // undefined = leave the stored shiny flag untouched; a boolean sets it.
  shiny?: boolean;
};

export type SaveEncounterResult = { success: true } | { success: false; error: ActionError };

// A SoulLink pair only forms when BOTH players catch. If either slot on the
// route ended Fled/Killed, the surviving catch is boxed - it must never hold
// a team slot, and the Team tab hides the link entirely. Classic runs have no
// partner, so nothing is ever broken there.
async function pairNeverFormed(runId: number, routeId: number): Promise<boolean> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run || run.mode !== RunMode.SOULLINK) return false;
  const failed = await prisma.encounter.count({
    where: {
      runId,
      routeId,
      status: { in: [EncounterStatus.FLED, EncounterStatus.KILLED] },
    },
  });
  return failed > 0;
}

// Auto-team: drop a route's link into the lowest free team slot (0-5) unless it
// already sits on the team. A full team is a no-op. Returns whether the link
// ended up on a slot. Shared by saveEncounter (a new catch auto-joins the team
// while slots are free) and quickCatch (one-tap catch from the Catchrate tab).
// Not exported: internal helper, so it stays out of the server-action surface.
async function autoAssignTeamSlot(runId: number, routeId: number): Promise<boolean> {
  const link = await prisma.soulLink.findUnique({
    where: { runId_routeId: { runId, routeId } },
  });
  if (!link) return false;
  if (await pairNeverFormed(runId, routeId)) return false;
  if (link.teamPosition !== null) return true;

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
  if (freeSlot === null) return false;

  const assigned = await setTeamSlot(runId, freeSlot, link.id);
  return assigned.success;
}

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
  // Resolves the run's own hand-added locations as well - a negative id is a
  // CustomRoute, not an unknown route.
  const route = await getRouteForRun(runId, run.gameId, routeId);
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

    // Infinite Fusion: re-declaring this slot with a different species, or
    // taking it off CAUGHT (Fled/Killed), dissolves any fusion it was part
    // of - in either role. A same-species/still-CAUGHT re-save (nickname,
    // shiny, ...) leaves an existing fusion alone.
    // Remembered so the team slots can be re-balanced once the save is done.
    let dissolvedGroup: number[] | null = null;
    if (existing && (existing.pokemonId !== pokemonId || status !== EncounterStatus.CAUGHT)) {
      const isDonor = existing.fusedIntoId !== null;
      const isHost = (await tx.encounter.count({ where: { fusedIntoId: existing.id } })) > 0;
      if (isDonor || isHost) {
        const group = await fusionGroupLinkIds(tx, runId, existing.soulLinkId);
        const onTeam = await tx.soulLink.count({
          where: { id: { in: group }, teamPosition: { not: null } },
        });
        dissolvedGroup = onTeam > 0 ? group : [];
      }
      if (isDonor) {
        await tx.encounter.update({ where: { id: existing.id }, data: { fusedIntoId: null } });
      }
      if (isHost) {
        await tx.encounter.updateMany({
          where: { fusedIntoId: existing.id },
          data: { fusedIntoId: null },
        });
      }
    }

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
        shiny: input.shiny ?? false,
        soulLinkId,
      },
      update: {
        pokemonId,
        currentPokemonId: pokemonId,
        familyId: pokemon.family_id,
        ...(nickname !== undefined && { nickname }),
        status,
        isStatic,
        ...(input.shiny !== undefined && { shiny: input.shiny }),
        soulLinkId,
      },
    });

    // Debug order log (see RouteEntry in schema.prisma): append-only, the
    // first write for a route wins and clearEncounter never removes it.
    // seenAt is backfilled from the earliest encounter on the route, so a run
    // that predates this feature keeps its real order instead of having every
    // route stamped with the day the log started.
    const logged = await tx.routeEntry.findUnique({
      where: { runId_routeId: { runId, routeId } },
    });
    if (!logged) {
      const first = await tx.encounter.findFirst({
        where: { runId, routeId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      await tx.routeEntry.create({
        data: { runId, routeId, seenAt: first?.createdAt ?? new Date() },
      });
    }

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

    // A dissolved fusion splits its group - same slot bookkeeping as
    // unfuseEncounter.
    if (dissolvedGroup !== null) await rebalanceTeamSlots(tx, runId, dissolvedGroup);
  });

  // A fresh catch joins the team automatically while there is a free slot, so
  // new links / solo catches show up on the team without a manual assign. Only
  // caught encounters qualify; a full team is silently left as-is.
  if (status === EncounterStatus.CAUGHT) {
    await autoAssignTeamSlot(runId, routeId);
  } else if (await pairNeverFormed(runId, routeId)) {
    // This save just broke the pair (Fled/Killed). The partner's catch may
    // already sit on a team slot from when the route still looked complete -
    // release it, otherwise it lingers as a team member the Team tab doesn't
    // even show.
    await prisma.soulLink.updateMany({
      where: { runId, routeId, teamPosition: { not: null } },
      data: { teamPosition: null },
    });
  }

  // The row is now a real Encounter - any pre-confirm draft for this slot is
  // stale and would otherwise linger as a ghost pick if the row is cleared
  // later.

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
  options?: { nickname?: string | null; shiny?: boolean },
): Promise<QuickCatchResult> {
  const saved = await saveEncounter({
    runId,
    routeId,
    player,
    pokemonId,
    status: EncounterStatus.CAUGHT,
    nickname: options?.nickname,
    shiny: options?.shiny,
  });
  if (!saved.success) return saved;

  // saveEncounter already dropped the fresh catch into a free team slot; report
  // whether it landed on the team (a full team is not an error).
  const link = await prisma.soulLink.findUnique({
    where: { runId_routeId: { runId, routeId } },
  });
  return { success: true, addedToTeam: link?.teamPosition != null };
}

// The last Journey milestone defeated in this run, in the game pack's display
// order - level cap ids are frozen while the array order is what the player
// walks through, so the file's order decides "last", not the id.
async function lastDefeatedLevelCapId(runId: number): Promise<number | null> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return null;
  const defeated = new Set(
    (
      await prisma.levelCapProgress.findMany({
        where: { runId, defeated: true },
        select: { levelCapId: true },
      })
    ).map((row) => row.levelCapId),
  );
  if (defeated.size === 0) return null;
  const caps = getLevelCaps(run.gameId).filter((cap) => defeated.has(cap.id));
  return caps.at(-1)?.id ?? null;
}

export type MarkDeadResult = { success: true } | { success: false; error: ActionError };

// deathPlayer (SoulLink only) records whose Pokémon fainted; both die
// together, this is just who lost theirs.
// Every fusion donor whose HOST belongs to one of these encounters - used to
// propagate a death (or revival) from a host's link to a donor's own link.
// Chains are rejected everywhere fusedIntoId is written, so this is exactly
// one level deep: a donor's own link can't itself have a donor fused in.
// Every SoulLink whose fate is tied to `startSoulLinkId`'s via a fusion, in
// EITHER direction, transitively: an encounter that is a DONOR pulls in its
// host's link (the in-game fusion rule - both components always die
// together, whichever one triggered it), and an encounter that is a HOST
// pulls in its donor's link, which can then chain again if that link's own
// encounters are themselves fused elsewhere. A single fusedIntoId hop is
// never more than one level (fuseEncounters rejects a donor that's also a
// host), but SoulLink PAIRS can still chain arbitrarily far in SoulLink mode,
// since each player fuses independently - e.g. player 1 fuses routes 1+3,
// player 2 fuses routes 2+4: killing route 1's link must reach route 3 (its
// own encounter's host) and, if route 3's OTHER encounter is itself fused
// into route 4, reach route 4 too. Missing this direction is exactly the bug
// a first version of this function had - it only ever looked from a link's
// encounters to their DONORS, never to the HOST a link's own encounter might
// itself be donated into.
async function linkedSoulLinkIds(
  tx: Prisma.TransactionClient,
  runId: number,
  startSoulLinkId: number,
): Promise<number[]> {
  const allEncounters = await tx.encounter.findMany({
    where: { runId },
    select: { id: true, soulLinkId: true, fusedIntoId: true },
  });
  type EncounterRow = (typeof allEncounters)[number];
  const bySoulLink = new Map<number, EncounterRow[]>();
  for (const e of allEncounters) {
    if (e.soulLinkId === null) continue;
    const list = bySoulLink.get(e.soulLinkId);
    if (list) list.push(e);
    else bySoulLink.set(e.soulLinkId, [e]);
  }
  const encounterById = new Map(allEncounters.map((e) => [e.id, e]));
  const donorByHostId = new Map(
    allEncounters.filter((e) => e.fusedIntoId !== null).map((e) => [e.fusedIntoId as number, e]),
  );

  const visited = new Set<number>([startSoulLinkId]);
  const queue = [startSoulLinkId];
  while (queue.length > 0) {
    const current = queue.pop() as number;
    for (const e of bySoulLink.get(current) ?? []) {
      const hostSoulLinkId =
        e.fusedIntoId !== null ? (encounterById.get(e.fusedIntoId)?.soulLinkId ?? null) : null;
      const donorSoulLinkId = donorByHostId.get(e.id)?.soulLinkId ?? null;
      for (const id of [hostSoulLinkId, donorSoulLinkId]) {
        if (id !== null && !visited.has(id)) {
          visited.add(id);
          queue.push(id);
        }
      }
    }
  }
  visited.delete(startSoulLinkId);
  return [...visited];
}

export async function markDead(
  runId: number,
  soulLinkId: number,
  deathPlayer?: Player | null,
  deathCause?: string | null,
): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({
    where: { id: soulLinkId },
    include: { encounters: true },
  });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }

  // Deliberately does NOT touch the encounters' status: the Encounter tab
  // tracks what happened at catch time (stays CAUGHT), while the link's
  // DEAD/ALIVE state lives on the SoulLink alone. A dead link also leaves
  // the team automatically (teamPosition -> null).
  const cause = (deathCause ?? "").trim().slice(0, 80) || null;
  // Where in the run this happened: the last Journey milestone already
  // defeated. Null when none is - that still counts as "recorded", which is
  // what diedAt marks, so the Memorial can tell it apart from the deaths that
  // predate this being tracked at all.
  const lastCap = await lastDefeatedLevelCapId(runId);
  const diedAt = new Date();
  const data = {
    status: LinkStatus.DEAD,
    teamPosition: null,
    deathPlayer: deathPlayer ?? null,
    deathCause: cause,
    deathLevelCapId: lastCap,
    diedAt,
  };

  await prisma.$transaction(async (tx) => {
    await tx.soulLink.update({ where: { id: soulLinkId }, data });
    // Infinite Fusion: every link this one's fusions transitively touch dies
    // too - see linkedSoulLinkIds for why this has to go both directions.
    const linkedIds = await linkedSoulLinkIds(tx, runId, soulLinkId);
    for (const id of linkedIds) await tx.soulLink.update({ where: { id }, data });
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

// Corrects (or clears) WHEN a link died, for the deaths recorded before this
// was tracked. null = back to "unknown", which parks it at the top of the
// Memorial; any other value must be a level cap of the run's game pack.
export async function setDeathPoint(
  runId: number,
  soulLinkId: number,
  levelCapId: number | null,
): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({ where: { id: soulLinkId } });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) return { success: false, error: { key: "runNotFound", id: runId } };
  if (levelCapId !== null && !getLevelCaps(run.gameId).some((cap) => cap.id === levelCapId)) {
    return { success: false, error: { key: "unknownLevelCap", id: levelCapId } };
  }

  await prisma.soulLink.update({
    where: { id: soulLinkId },
    data: {
      deathLevelCapId: levelCapId,
      // Setting a point marks it as recorded; clearing sends it back to the
      // unknown group.
      diedAt: levelCapId === null ? null : soulLink.diedAt ?? new Date(),
    },
  });

  revalidatePath("/overview");
  publishChange(runId);
  return { success: true };
}

// Counterpart to markDead - only flips the link's own status back, the
// encounters' catch status was never touched.
export async function markAlive(runId: number, soulLinkId: number): Promise<MarkDeadResult> {
  const soulLink = await prisma.soulLink.findUnique({
    where: { id: soulLinkId },
    include: { encounters: true },
  });
  if (!soulLink || soulLink.runId !== runId) {
    return { success: false, error: { key: "soulLinkNotFound", id: soulLinkId } };
  }

  const data = { status: LinkStatus.ALIVE, deathPlayer: null, deathCause: null };

  await prisma.$transaction(async (tx) => {
    await tx.soulLink.update({ where: { id: soulLinkId }, data });
    // Mirrors markDead: every linked SoulLink shares one fate.
    const linkedIds = await linkedSoulLinkIds(tx, runId, soulLinkId);
    for (const id of linkedIds) await tx.soulLink.update({ where: { id }, data });
  });

  revalidatePath("/tracker");
  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Infinite Fusion: fusing two of a player's own catches into one battle unit.
// Both stay ordinary Encounter rows - see the fusedIntoId comment in
// schema.prisma. These three actions are the only place fusedIntoId is ever
// written directly; saveEncounter (species/status change dissolves a fusion)
// and markDead/markAlive (death/revival propagate to a fused-in donor) also
// touch it, but by reading it, not by these actions' validation rules.
// ---------------------------------------------------------------------------

export type FuseResult = { success: true } | { success: false; error: ActionError };

// Keeps team slots in step with fusion groups (src/lib/fusionGroups.ts): a
// group on the team holds exactly as many slots as it needs - one per battle
// unit of whichever player has more. So once both players have fused the same
// two routes their group gives a slot back, and while only one of them has,
// the other player's two separate Pokémon keep two. Extra slots are released
// from the highest position; missing ones are taken from free slots while
// there are any (a full team just leaves the group short).
//
// `keepOnTeam`: link ids whose group must stay on the team even when none of
// its links currently holds a slot - unfusing splits a group, and the half
// that held no slot would otherwise silently drop out of the team.
//
// `fill: false` only releases surplus slots - setTeamSlot's clean-up of state
// written before this bookkeeping existed, where filling first could grab
// the very slot the user is about to assign.
//
// A no-op for runs without fusions: every link is its own group needing one
// slot, which it either already has or never had.
async function rebalanceTeamSlots(
  tx: Prisma.TransactionClient,
  runId: number,
  keepOnTeam: number[] = [],
  { fill = true }: { fill?: boolean } = {},
): Promise<void> {
  const run = await tx.run.findUnique({ where: { id: runId }, select: { mode: true } });
  const links = await tx.soulLink.findMany({
    where: { runId },
    select: { id: true, routeId: true, status: true, teamPosition: true },
    orderBy: { id: "asc" },
  });
  const encounters = await tx.encounter.findMany({
    where: { runId },
    select: { id: true, soulLinkId: true, player: true, fusedIntoId: true, routeId: true, status: true },
  });
  // A never-formed pair must not hold a slot (same rule as autoAssignTeamSlot).
  const failedRouteIds = new Set(
    run?.mode === RunMode.SOULLINK
      ? encounters
          .filter((e) => e.status === EncounterStatus.FLED || e.status === EncounterStatus.KILLED)
          .map((e) => e.routeId)
      : [],
  );
  const linkById = new Map(links.map((l) => [l.id, l]));
  const keep = new Set(keepOnTeam);
  const occupied = new Set(links.flatMap((l) => (l.teamPosition === null ? [] : [l.teamPosition])));
  const releases: number[] = [];
  const fills: number[] = [];

  for (const group of groupSoulLinks(links.map((l) => l.id), encounters)) {
    const members = group.map((id) => linkById.get(id)!);
    if (members.some((l) => l.status === LinkStatus.DEAD)) continue;
    const onTeam = members
      .filter((l) => l.teamPosition !== null)
      .sort((a, b) => (a.teamPosition as number) - (b.teamPosition as number));
    if (onTeam.length === 0 && !group.some((id) => keep.has(id))) continue;
    const memberIds = new Set(group);
    const need = teamSlotsNeeded(
      encounters.filter((e) => e.soulLinkId !== null && memberIds.has(e.soulLinkId)),
    );
    if (onTeam.length > need) {
      releases.push(...onTeam.slice(need).map((l) => l.id));
    } else if (fill && onTeam.length < need) {
      fills.push(
        ...members
          .filter((l) => l.teamPosition === null && !failedRouteIds.has(l.routeId))
          .slice(0, need - onTeam.length)
          .map((l) => l.id),
      );
    }
  }

  // Releases first, so a slot one group gives back is free for another.
  for (const id of releases) {
    occupied.delete(linkById.get(id)!.teamPosition as number);
    await tx.soulLink.update({ where: { id }, data: { teamPosition: null } });
  }
  for (const id of fills) {
    const free = [0, 1, 2, 3, 4, 5].find((i) => !occupied.has(i));
    if (free === undefined) break;
    occupied.add(free);
    await tx.soulLink.update({ where: { id }, data: { teamPosition: free } });
  }
}

// Every link id in the same fusion group as `soulLinkId`, itself included.
async function fusionGroupLinkIds(
  tx: Prisma.TransactionClient,
  runId: number,
  soulLinkId: number | null,
): Promise<number[]> {
  if (soulLinkId === null) return [];
  return [soulLinkId, ...(await linkedSoulLinkIds(tx, runId, soulLinkId))];
}

// Kopf = hostId (keeps its own route/link untouched), Körper = donorId (its
// fusedIntoId now points at the host). Chains are rejected: neither side may
// already be part of another fusion, in either role - a donor can't also
// host, and a host can't also donate elsewhere.
export async function fuseEncounters(
  runId: number,
  hostId: number,
  donorId: number,
): Promise<FuseResult> {
  if (hostId === donorId) {
    return { success: false, error: { key: "fusionSameEncounter" } };
  }
  const [host, donor] = await Promise.all([
    prisma.encounter.findUnique({ where: { id: hostId }, include: { soulLink: true } }),
    prisma.encounter.findUnique({ where: { id: donorId }, include: { soulLink: true } }),
  ]);
  if (!host || host.runId !== runId) {
    return { success: false, error: { key: "encounterNotFound", id: hostId } };
  }
  if (!donor || donor.runId !== runId) {
    return { success: false, error: { key: "encounterNotFound", id: donorId } };
  }
  if (host.player !== donor.player) {
    return { success: false, error: { key: "fusionDifferentPlayer" } };
  }
  if (
    host.status !== EncounterStatus.CAUGHT ||
    donor.status !== EncounterStatus.CAUGHT ||
    host.soulLink?.status === LinkStatus.DEAD ||
    donor.soulLink?.status === LinkStatus.DEAD
  ) {
    return { success: false, error: { key: "fusionNotCaught" } };
  }
  const [hostAlreadyHosts, donorAlreadyHosts] = await Promise.all([
    prisma.encounter.findUnique({ where: { fusedIntoId: hostId } }),
    prisma.encounter.findUnique({ where: { fusedIntoId: donorId } }),
  ]);
  if (
    host.fusedIntoId !== null ||
    donor.fusedIntoId !== null ||
    hostAlreadyHosts !== null ||
    donorAlreadyHosts !== null
  ) {
    return { success: false, error: { key: "fusionChain" } };
  }
  // A boxed catch whose SoulLink pair never formed isn't a usable Pokémon.
  if ((await pairNeverFormed(runId, host.routeId)) || (await pairNeverFormed(runId, donor.routeId))) {
    return { success: false, error: { key: "fusionNotCaught" } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.encounter.update({ where: { id: donorId }, data: { fusedIntoId: hostId } });
    await rebalanceTeamSlots(tx, runId);
  });

  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

// hostId is the fusion's head; its donor (if any) is looked up via
// fusedIntoId rather than passed in, so the caller only ever needs the one id
// that stays stable across the fusion's lifetime.
export async function unfuseEncounter(runId: number, hostId: number): Promise<FuseResult> {
  const host = await prisma.encounter.findUnique({
    where: { id: hostId },
    include: { soulLink: true },
  });
  if (!host || host.runId !== runId) {
    return { success: false, error: { key: "encounterNotFound", id: hostId } };
  }
  const donor = await prisma.encounter.findUnique({
    where: { fusedIntoId: hostId },
    include: { soulLink: true },
  });
  if (!donor) {
    return { success: false, error: { key: "fusionNotFound" } };
  }
  if (host.soulLink?.status === LinkStatus.DEAD || donor.soulLink?.status === LinkStatus.DEAD) {
    return { success: false, error: { key: "fusionDead" } };
  }

  await prisma.$transaction(async (tx) => {
    // Unfusing can split the group in two; whichever half held no slot must
    // not drop out of the team just because the other half kept it.
    const groupBefore = await fusionGroupLinkIds(tx, runId, host.soulLinkId);
    const wasOnTeam =
      (await tx.soulLink.count({ where: { id: { in: groupBefore }, teamPosition: { not: null } } })) > 0;
    await tx.encounter.update({ where: { id: donor.id }, data: { fusedIntoId: null } });
    await rebalanceTeamSlots(tx, runId, wasOnTeam ? groupBefore : []);
  });

  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

// The DNA Reverser: swaps which of the pair is head and which is body. hostId
// is the CURRENT head - after this call the current donor is the head
// instead, so a caller tracking "the fusion at hostId" must switch to
// tracking the (former) donor's id.
export async function swapFusion(runId: number, hostId: number): Promise<FuseResult> {
  const host = await prisma.encounter.findUnique({
    where: { id: hostId },
    include: { soulLink: true },
  });
  if (!host || host.runId !== runId) {
    return { success: false, error: { key: "encounterNotFound", id: hostId } };
  }
  const donor = await prisma.encounter.findUnique({
    where: { fusedIntoId: hostId },
    include: { soulLink: true },
  });
  if (!donor) {
    return { success: false, error: { key: "fusionNotFound" } };
  }
  if (host.soulLink?.status === LinkStatus.DEAD || donor.soulLink?.status === LinkStatus.DEAD) {
    return { success: false, error: { key: "fusionDead" } };
  }

  await prisma.$transaction(async (tx) => {
    // fusedIntoId is @unique, so the old pointer must clear before the new
    // one can be written, or the two rows would momentarily both target it.
    await tx.encounter.update({ where: { id: donor.id }, data: { fusedIntoId: null } });
    await tx.encounter.update({ where: { id: hostId }, data: { fusedIntoId: donor.id } });
    // Same group, same number of units - kept for data written before group
    // slot bookkeeping existed.
    await rebalanceTeamSlots(tx, runId);
  });

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

// Switches a caught Pokémon to one of its alternate formes (Deoxys Attack,
// Wash Rotom, ...) or back to the base forme. Like evolving, this only ever
// touches currentPokemonId - what was caught on the route is untouched - and
// it never changes family_id, so the Species Clause is unaffected. The target
// must be a forme of the CURRENT species (or that species itself), which also
// stops a forme swap from doubling as an evolution.
export async function setPokemonForm(
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

  const current = getPokemonById(encounter.currentPokemonId);
  const target = getPokemonById(targetPokemonId);
  if (!current || !target) {
    return { success: false, error: { key: "unknownPokemon", id: targetPokemonId } };
  }
  const currentSpecies = current.baseId ?? current.id;
  const targetSpecies = target.baseId ?? target.id;
  if (currentSpecies !== targetSpecies || target.family_id !== encounter.familyId) {
    return { success: false, error: { key: "invalidFormTarget" } };
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
//
// Infinite Fusion: slots belong to fusion GROUPS (see rebalanceTeamSlots), so
// both "vacate" steps act on the whole group - replacing or emptying any slot
// of a group takes the entire group off the team, and a group put onto a slot
// then claims whatever further slots it needs. Every link is its own group in
// a run without fusions, which makes this exactly the old behaviour there.
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
    // A group holding more slots than it needs (older data) must not count
    // as occupying the surplus one - the Team tab shows that slot as empty.
    await rebalanceTeamSlots(tx, runId, [], { fill: false });
    const occupant = await tx.soulLink.findFirst({
      where: { runId, teamPosition: position },
      select: { id: true },
    });
    const vacate = new Set([
      ...(await fusionGroupLinkIds(tx, runId, occupant?.id ?? null)),
      ...(await fusionGroupLinkIds(tx, runId, soulLinkId)),
    ]);
    if (vacate.size > 0) {
      await tx.soulLink.updateMany({
        where: { runId, id: { in: [...vacate] } },
        data: { teamPosition: null },
      });
    }
    if (soulLinkId !== null) {
      await tx.soulLink.update({ where: { id: soulLinkId }, data: { teamPosition: position } });
      await rebalanceTeamSlots(tx, runId);
    }
  });

  revalidatePath("/links");
  publishChange(runId);
  return { success: true };
}

// Empties all six team slots at once. Only the slot assignment is cleared -
// the links themselves (and everything on the Encounter tab) are untouched,
// exactly like setting each slot to "leer" by hand would.
export async function clearTeam(runId: number): Promise<SetTeamSlotResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  await prisma.soulLink.updateMany({
    where: { runId, teamPosition: { not: null } },
    data: { teamPosition: null },
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
  revalidatePath("/typen");
  revalidatePath("/overview");
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

// --- Custom routes --------------------------------------------------------
//
// Per run, never per game pack: a pack's routes.json is shared by every run
// that plays that game, and "we counted three more statics this time" is a
// property of one playthrough. See CustomRoute in schema.prisma for why the
// exposed id is negative and assigned rather than derived.

export type AddCustomRouteResult =
  | { success: true; routeId: number }
  | { success: false; error: ActionError };

export async function addCustomRoute(
  runId: number,
  name: string,
  type: "route" | "static",
  // Id of the route this one follows in the list; null = at the very top.
  afterRouteId: number | null,
): Promise<AddCustomRouteResult> {
  const trimmed = name.trim().slice(0, CUSTOM_ROUTE_NAME_MAX);
  if (!trimmed) {
    return { success: false, error: { key: "nameRequired" } };
  }

  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }
  // An anchor must be a route this run actually has, or the new entry would
  // silently land at the end of the list instead of where it was asked for.
  if (afterRouteId !== null && !(await getRouteForRun(runId, run.gameId, afterRouteId))) {
    return { success: false, error: { key: "unknownRoute", id: afterRouteId } };
  }

  const routeId = await nextCustomRouteId(runId);
  await prisma.customRoute.create({
    data: { runId, routeId, name: trimmed, type, afterRouteId },
  });

  revalidateRunViews();
  publishChange(runId);
  return { success: true, routeId };
}

export type DeleteCustomRouteResult = { success: true } | { success: false; error: ActionError };

// Takes the route's encounters (and their SoulLink) with it. There is no
// foreign key on routeId - for every other route it points into a JSON pack -
// so the cleanup is explicit. The UI confirms first and says how many
// encounters are about to go with it.
export async function deleteCustomRoute(
  runId: number,
  routeId: number,
): Promise<DeleteCustomRouteResult> {
  if (!isCustomRouteId(routeId)) {
    return { success: false, error: { key: "unknownRoute", id: routeId } };
  }
  const row = await prisma.customRoute.findUnique({
    where: { runId_routeId: { runId, routeId } },
  });
  if (!row) {
    return { success: false, error: { key: "unknownRoute", id: routeId } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.encounter.deleteMany({ where: { runId, routeId } });
    await tx.soulLink.deleteMany({ where: { runId, routeId } });
    await tx.routeEntry.deleteMany({ where: { runId, routeId } });
    // Anything anchored to this route inherits its anchor, so the rest of the
    // list stays put instead of jumping to the top.
    await tx.customRoute.updateMany({
      where: { runId, afterRouteId: routeId },
      data: { afterRouteId: row.afterRouteId },
    });
    await tx.customRoute.delete({ where: { id: row.id } });
  });

  revalidateRunViews();
  publishChange(runId);
  return { success: true };
}

// --- Free team ------------------------------------------------------------
//
// A free team member is an ordinary Encounter on a hidden CustomRoute. That
// one trick is what makes this feature nearly free: the battle matchup, team
// coverage, evolutions, the Pokedex link, backups and live sync all keep
// working because there is nothing new for them to understand. The route is
// flagged `hidden` so it stays off the Encounter tab and out of the progress
// bar, which are the only two places it would look wrong.

export type AddFreeTeamMemberResult =
  | { success: true; routeId: number }
  | { success: false; error: ActionError };

export async function addFreeTeamMember(
  runId: number,
  pokemonId: number,
  player: Player,
  nickname?: string,
): Promise<AddFreeTeamMemberResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }
  if (!getPokemonById(pokemonId)) {
    return { success: false, error: { key: "unknownPokemon", id: pokemonId } };
  }

  // Anchored to the end of the current list rather than the top: the Team tab
  // and the Memorial sort by position in the route list, so appending is what
  // makes members read in the order they were added.
  const existing = await getRoutesForRun(runId, run.gameId);
  const last = existing.at(-1)?.id ?? null;
  const slotNumber = (await prisma.customRoute.count({ where: { runId, hidden: true } })) + 1;
  const routeId = await nextCustomRouteId(runId);

  await prisma.customRoute.create({
    data: {
      runId,
      routeId,
      // Language-neutral on purpose: the label is almost never seen (the Team
      // tab shows the Pokemon's own name) and the action has no `lang`.
      name: `Team ${slotNumber}`,
      type: "route",
      afterRouteId: last,
      hidden: true,
    },
  });

  // Straight through the normal write path, which creates the SoulLink and
  // calls autoAssignTeamSlot - so the member lands in the first free of the
  // six slots with no extra code here.
  const saved = await saveEncounter({
    runId,
    routeId,
    player,
    pokemonId,
    status: EncounterStatus.CAUGHT,
    nickname: nickname ?? null,
  });
  if (!saved.success) {
    // Do not leave an empty slot behind if the encounter was rejected.
    await prisma.customRoute.deleteMany({ where: { runId, routeId } });
    return saved;
  }

  revalidateRunViews();
  publishChange(runId);
  return { success: true, routeId };
}

// --- Debug: encounter order export ----------------------------------------

export type ExportRouteOrderResult =
  | { success: true; text: string }
  | { success: false; error: ActionError };

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

// A plain-text report meant to be pasted into a coding agent whose job is to
// reorder data/games/<gameId>/routes.json. It deliberately carries BOTH
// lists: a run in progress has only visited part of the map, so the observed
// order alone would not say where the untouched routes belong.
export async function exportRouteOrder(runId: number): Promise<ExportRouteOrderResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  // Hidden routes are free-team slots, not locations - they would only add
  // noise to a report about the order the map was played in.
  const routes = (await getRoutesForRun(runId, run.gameId)).filter((route) => !route.hidden);
  const [entries, encounters] = await Promise.all([
    prisma.routeEntry.findMany({ where: { runId }, select: { routeId: true, seenAt: true } }),
    prisma.encounter.findMany({ where: { runId }, select: { routeId: true, createdAt: true } }),
  ]);

  // The log is authoritative; Encounter.createdAt covers routes entered before
  // the log existed. Both answer "when was this route first touched".
  const logged = new Map(entries.map((entry) => [entry.routeId, entry.seenAt]));
  const earliest = new Map<number, Date>();
  for (const encounter of encounters) {
    const current = earliest.get(encounter.routeId);
    if (!current || encounter.createdAt < current) {
      earliest.set(encounter.routeId, encounter.createdAt);
    }
  }

  const seenAt = new Map<number, Date>();
  for (const route of routes) {
    const when = logged.get(route.id) ?? earliest.get(route.id);
    if (when) seenAt.set(route.id, when);
  }

  const observed = [...seenAt.entries()]
    .sort((a, b) => a[1].getTime() - b[1].getTime())
    .map(([routeId]) => routeId);
  const observedPos = new Map(observed.map((routeId, index) => [routeId, index + 1]));
  const currentPos = new Map(routes.map((route, index) => [route.id, index + 1]));
  const byId = new Map(routes.map((route) => [route.id, route]));
  const nameOf = (routeId: number) => {
    const route = byId.get(routeId);
    return route ? localizeName(route.names, "de") : "?" + routeId;
  };

  const lines: string[] = [
    "# Encounter order export",
    "# Run: " + run.name + " (id " + run.id + ")  |  game pack: " + run.gameId,
    "# Generated: " + new Date().toISOString(),
    "#",
    "# Task: reorder data/games/" + run.gameId + "/routes.json so its array order",
    "# matches the observed order below. ROUTE IDS ARE STABLE AND MUST NOT BE",
    "# RENUMBERED OR REUSED - the database references them. Only the order of",
    "# the array changes. Names shown are the names.de values.",
    "# Negative ids are this run's own additions and are NOT part of",
    "# routes.json - ignore them when editing the file.",
    "",
    "## Observed order (" + observed.length + " of " + routes.length + " routes entered)",
  ];

  if (observed.length === 0) {
    lines.push("   (nothing entered yet)");
  } else {
    observed.forEach((routeId, index) => {
      const target = index + 1;
      const now = currentPos.get(routeId) ?? 0;
      const move = now === target ? "" : "   -> move to " + target;
      lines.push(
        "  " +
          String(target).padStart(3) +
          ". id " +
          pad(routeId, 6) +
          pad(nameOf(routeId), 32) +
          "routes.json pos " +
          pad(now, 4) +
          move,
      );
    });
  }

  lines.push("", "## Current order (" + routes.length + " entries)");
  routes.forEach((route, index) => {
    const seen = observedPos.get(route.id);
    const note = route.custom
      ? seen
        ? "custom, observed " + seen
        : "custom, not entered yet"
      : seen
        ? "observed " + seen
        : "not entered yet";
    lines.push(
      "  " +
        String(index + 1).padStart(3) +
        ". id " +
        pad(route.id, 6) +
        pad(localizeName(route.names, "de"), 32) +
        pad(route.type, 8) +
        note,
    );
  });

  return { success: true, text: lines.join("\n") + "\n" };
}

// --- Rule presets ---------------------------------------------------------
//
// A preset is a named snapshot of the rule toggles plus the house-rules
// markdown, stored app-wide rather than per run - the whole point is to carry
// a ruleset from one playthrough into the next, so every run's Rules tab
// offers the same list. None of these actions calls publishChange for the
// preset list itself: the list is not run state, and the two that do change a
// run (apply) publish for that run.

export type SaveRulePresetResult =
  | { success: true; id: number }
  | { success: false; error: ActionError };

// Snapshots what is STORED on the run, never what sits unsaved in the notes
// editor - the Rules tab disables this while editing for exactly that reason.
// `lang` mirrors what rules/page.tsx renders: a run created before the rules
// feature has an empty rulesMarkdown and shows the built-in ruleset, so
// without this fallback its preset would come out blank.
export async function saveRulePreset(
  runId: number,
  name: string,
  lang: Lang,
): Promise<SaveRulePresetResult> {
  const trimmed = name.trim().slice(0, PRESET_NAME_MAX);
  if (!trimmed) {
    return { success: false, error: { key: "nameRequired" } };
  }

  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }

  const data = {
    settingsJson: serializePresetSettings(parseRunSettings(run.settingsJson)),
    rulesMarkdown: run.rulesMarkdown.trim() ? run.rulesMarkdown : DEFAULT_RULES[lang],
  };
  // Upsert on the unique name: saving under a name that already exists is an
  // overwrite, which is what the dialog offers ("Overwrite" instead of "Save").
  const preset = await prisma.rulePreset.upsert({
    where: { name: trimmed },
    create: { name: trimmed, ...data },
    update: data,
  });

  revalidatePath("/rules");
  return { success: true, id: preset.id };
}

export type ApplyRulePresetResult = { success: true } | { success: false; error: ActionError };

// Overwrites the run's toggles and house rules with the preset's. The run's
// own playerNames survive - a preset never carries them (see
// serializePresetSettings).
export async function applyRulePreset(
  runId: number,
  presetId: number,
): Promise<ApplyRulePresetResult> {
  const run = await prisma.run.findUnique({ where: { id: runId } });
  if (!run) {
    return { success: false, error: { key: "runNotFound", id: runId } };
  }
  const preset = await prisma.rulePreset.findUnique({ where: { id: presetId } });
  if (!preset) {
    return { success: false, error: { key: "presetNotFound", id: presetId } };
  }

  // parseRunSettings defaults every key the preset does not mention, so an
  // older preset saved before a new toggle existed applies that toggle's
  // default rather than leaving the run's current value dangling.
  const next = parseRunSettings(preset.settingsJson);
  next.playerNames = parseRunSettings(run.settingsJson).playerNames;

  await prisma.run.update({
    where: { id: runId },
    data: {
      settingsJson: JSON.stringify(next),
      rulesMarkdown: preset.rulesMarkdown,
    },
  });

  // Same fan-out as updateRunSettings - the toggles drive rendering on several
  // tabs, not just this one.
  revalidatePath("/rules");
  revalidatePath("/tracker");
  revalidatePath("/links");
  revalidatePath("/typen");
  revalidatePath("/overview");
  publishChange(runId);
  return { success: true };
}

export type DeleteRulePresetResult = { success: true } | { success: false; error: ActionError };

// App-wide, so this removes it from every run's list. Runs that had it applied
// keep their rules - a preset is a template, not a live link.
export async function deleteRulePreset(presetId: number): Promise<DeleteRulePresetResult> {
  const preset = await prisma.rulePreset.findUnique({ where: { id: presetId } });
  if (!preset) {
    return { success: false, error: { key: "presetNotFound", id: presetId } };
  }

  await prisma.rulePreset.delete({ where: { id: presetId } });
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

export type BackupZipResult =
  | { success: true; filename: string; zipBase64: string }
  | { success: false; error: ActionError };

// One JSON file per run, zipped - each entry is independently importable
// (same shape a single-run export produces), instead of one combined JSON.
export async function exportAllBackup(): Promise<BackupZipResult> {
  const { filename, data } = await buildBackupZip();
  return { success: true, filename, zipBase64: Buffer.from(data).toString("base64") };
}

export type ImportBackupResult =
  | { success: true; runCount: number }
  | { success: false; error: ActionError };

// Non-destructive: imported runs are ADDED as new runs, existing data is never
// touched or overwritten. `names`, when given, overrides each backup run's
// stored name (same order as `parsed.runs`) - the Import dialog always
// collects a fresh name per run so a re-imported backup never silently
// shadows a newer run that kept the original name.
export async function importBackup(json: string, names?: string[]): Promise<ImportBackupResult> {
  const parsed = parseBackup(json);
  if (!parsed) {
    return { success: false, error: { key: "backupInvalid" } };
  }
  if (parsed.runs.length === 0) {
    return { success: false, error: { key: "backupEmpty" } };
  }
  if (names) {
    parsed.runs = parsed.runs.map((run, i) => {
      const name = names[i]?.trim();
      return name ? { ...run, name } : run;
    });
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
