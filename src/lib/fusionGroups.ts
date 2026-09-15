// Infinite Fusion: which SoulLinks belong together because a fusion connects
// them. Client-safe and pure, shared by the Team tab (one card per group) and
// the team-slot bookkeeping in actions.ts, so both always agree on what a
// "group" is.
//
// A fusion can join catches from two different routes, so once players fuse
// the route is no longer the unit a card can be built around: if player 1
// fuses Starter (head) + Route 1 (body) and player 2 fuses Route 1 (head) +
// Starter (body), each player now has ONE battle unit made of the same two
// routes. A per-route card puts player 1's fusion next to player 2's leftover
// donor on one card and the reverse on the other - which is exactly the
// "players are paired wrong" mess. The group of links a fusion touches is
// also the unit that dies together (markDead's linkedSoulLinkIds), so a card
// per group shows the pairing that actually has consequences.

export type GroupableEncounter = {
  id: number;
  soulLinkId: number | null;
  player: string;
  fusedIntoId: number | null;
};

// Connected components of `linkIds` under fusion edges (donor's link <->
// host's link). Groups come back in the order their first link appears in
// `linkIds`, and each group's ids keep that order too - pass the ids already
// sorted the way they should be displayed. A fusion edge to a link outside
// `linkIds` is ignored (e.g. a link the Team tab filters out).
export function groupSoulLinks(linkIds: number[], encounters: GroupableEncounter[]): number[][] {
  const index = new Map(linkIds.map((id, i) => [id, i]));
  const parent = linkIds.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  const byId = new Map(encounters.map((e) => [e.id, e]));
  for (const donor of encounters) {
    if (donor.fusedIntoId === null || donor.soulLinkId === null) continue;
    const hostLinkId = byId.get(donor.fusedIntoId)?.soulLinkId ?? null;
    if (hostLinkId === null) continue;
    const a = index.get(donor.soulLinkId);
    const b = index.get(hostLinkId);
    if (a === undefined || b === undefined) continue;
    const ra = find(a);
    const rb = find(b);
    // Keep the root at the earlier position so group order stays stable.
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }

  const groups = new Map<number, number[]>();
  linkIds.forEach((id, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(id);
    else groups.set(root, [id]);
  });
  return [...groups.values()];
}

export type GroupableLink = {
  id: number;
  teamPosition: number | null;
  encounters: GroupableEncounter[];
};

// Every link whose fusion group holds a team slot. A group's slots sit on only
// some of its links (rebalanceTeamSlots), so "does this link have a
// teamPosition" is the wrong question once fusions exist: after a crosswise
// fusion the second route holds no slot, yet player 2's fusion lives there
// and is just as much on the team.
export function teamLinkIds(links: GroupableLink[]): Set<number> {
  return new Set(
    [...groupTeamPositions(links)].filter(([, position]) => position !== null).map(([id]) => id),
  );
}

// Each link's GROUP team position: the lowest slot any link of its fusion
// group holds, or null when the group is off the team. What to sort team
// members by, for the same reason as teamLinkIds.
export function groupTeamPositions(links: GroupableLink[]): Map<number, number | null> {
  const byId = new Map(links.map((link) => [link.id, link]));
  const positions = new Map<number, number | null>();
  for (const group of groupSoulLinks(
    links.map((link) => link.id),
    links.flatMap((link) => link.encounters),
  )) {
    const held = group
      .map((id) => byId.get(id)?.teamPosition)
      .filter((position): position is number => position != null);
    const lowest = held.length > 0 ? Math.min(...held) : null;
    for (const id of group) positions.set(id, lowest);
  }
  return positions;
}

// Whether `e` is folded into another encounter of the same group - i.e. shown
// as the body of its host's tile rather than as a unit of its own. A donor
// whose host lies outside the group (filtered out) still counts as a unit, so
// it never silently disappears.
export function isFoldedDonor(e: GroupableEncounter, groupEncounterIds: Set<number>): boolean {
  return e.fusedIntoId !== null && groupEncounterIds.has(e.fusedIntoId);
}

// How many team slots a group needs: the most battle units any one player has
// in it. Player 1 with one fusion and player 2 with the same two catches still
// unfused need two slots (player 2 carries two Pokémon); once player 2 fuses
// as well, one slot is enough. Never less than 1.
export function teamSlotsNeeded(groupEncounters: GroupableEncounter[]): number {
  const ids = new Set(groupEncounters.map((e) => e.id));
  const units = new Map<string, number>();
  for (const e of groupEncounters) {
    if (isFoldedDonor(e, ids)) continue;
    units.set(e.player, (units.get(e.player) ?? 0) + 1);
  }
  return Math.max(1, ...units.values());
}
