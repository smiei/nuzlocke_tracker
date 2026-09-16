import { EncounterStatus, type Player } from "@/generated/prisma/enums";
import type { RunSettings } from "@/lib/runSettings";

// The Species Clause, defined once. Which encounters lock an evolution family
// for which player used to be worked out separately by the Encounter tab, the
// Kampf & Fang picker and the Pokédex - and the three disagreed (only the
// Encounter tab knew about the Shiny Clause, the Pokédex ignored even the
// clause's own switch). Every one of them asks this module now.
//
// The clause is informational everywhere: nothing here blocks a save.
//
// Three ways a run can play it (RunSettings):
//   - speciesClause alone: any encounter anywhere in the run - caught, fled
//     or defeated - uses up its family for every player.
//   - + speciesClausePerPlayer: each player has a clause of their own; an
//     encounter only uses up the family for the player who had it.
//   - + speciesClauseLinkedLocksAll (on top of per player): the way many
//     YouTubers play it. A fled or defeated encounter still locks only its own
//     player, but once a LINK forms - every player of the run caught on that
//     route - its families are used up for everyone. A link that is still
//     waiting for a player, or never formed, locks only the players who caught.
// Classic has one player, so all three read the same there.

export type ClauseEncounter = {
  id: number;
  routeId: number;
  player: Player;
  familyId: number;
  status: EncounterStatus;
  shiny: boolean;
  isFusionBody: boolean;
  fusedIntoId: number | null;
};

export type ClauseRules = Pick<
  RunSettings,
  | "speciesClause"
  | "shinyClause"
  | "fusionLocksBothFamilies"
  | "speciesClausePerPlayer"
  | "speciesClauseLinkedLocksAll"
>;

export type ClauseContext = {
  rules: ClauseRules;
  // The run's players (src/lib/players.ts).
  players: readonly Player[];
  // Hidden route -> the route it belongs to, for a split-off wild fusion body
  // whose own link is bound to its route's link (see boundRouteMap).
  boundRouteOf?: ReadonlyMap<number, number>;
};

// A split-off body's link carries a bond to its route's link; this turns the
// run's links into "hidden route -> real route", which is what the clause needs.
export function boundRouteMap(
  links: readonly { id: number; routeId: number; boundToId: number | null }[],
): Map<number, number> {
  const routeOfLink = new Map(links.map((link) => [link.id, link.routeId]));
  const map = new Map<number, number>();
  for (const link of links) {
    if (link.boundToId === null) continue;
    const routeId = routeOfLink.get(link.boundToId);
    if (routeId !== undefined) map.set(link.routeId, routeId);
  }
  return map;
}

// The route an encounter's catch belongs to. A fusion body lives on a hidden
// route of its own, but it was caught on its head's route (a wild body) or
// split off a catch on its link's route (a split body).
function catchRouteId(
  e: ClauseEncounter,
  byId: ReadonlyMap<number, ClauseEncounter>,
  boundRouteOf: ReadonlyMap<number, number> | undefined,
): number {
  if (e.isFusionBody && e.fusedIntoId !== null) {
    const head = byId.get(e.fusedIntoId);
    if (head) return head.routeId;
  }
  return boundRouteOf?.get(e.routeId) ?? e.routeId;
}

// Routes with a formed link: every player of the run has a CAUGHT encounter
// on that route itself. A later death does not undo that - the family was
// caught. Fusion bodies are extra Pokémon of a catch, not entries of their
// own, so they neither form nor block a link.
export function formedRouteIds(
  encounters: readonly ClauseEncounter[],
  players: readonly Player[],
): Set<number> {
  const caughtBy = new Map<number, Set<Player>>();
  for (const e of encounters) {
    if (e.isFusionBody || e.status !== EncounterStatus.CAUGHT) continue;
    const set = caughtBy.get(e.routeId) ?? new Set<Player>();
    set.add(e.player);
    caughtBy.set(e.routeId, set);
  }
  const formed = new Set<number>();
  for (const [routeId, set] of caughtBy) {
    if (players.every((player) => set.has(player))) formed.add(routeId);
  }
  return formed;
}

// A clause "view" of the run: build it once per render/page, then ask it which
// encounters (lockingEncounters) or families (lockedFamilies) count against a
// player.
export function clauseView<T extends ClauseEncounter>(encounters: readonly T[], ctx: ClauseContext) {
  const { rules, players, boundRouteOf } = ctx;
  const byId = new Map(encounters.map((e) => [e.id, e]));
  const formed = formedRouteIds(encounters, players);
  const perPlayer = rules.speciesClausePerPlayer && players.length > 1;

  function locks(e: T, player: Player): boolean {
    if (!rules.speciesClause) return false;
    // Shiny Clause: a shiny catch is exempt and doesn't lock its family.
    if (rules.shinyClause && e.shiny) return false;
    // A wild-caught fusion's body is half of one catch; a run can rule that
    // it doesn't lock a family of its own.
    if (e.isFusionBody && !rules.fusionLocksBothFamilies) return false;
    if (!perPlayer || e.player === player) return true;
    return rules.speciesClauseLinkedLocksAll && formed.has(catchRouteId(e, byId, boundRouteOf));
  }

  function lockedFamilies(player: Player): Set<number> {
    return new Set(encounters.filter((e) => locks(e, player)).map((e) => e.familyId));
  }

  return {
    // The encounters that count against `player`, minus whatever `exclude`
    // says (the Encounter tab leaves out the slot being edited).
    lockingEncounters(player: Player, exclude: (e: T) => boolean = () => false): T[] {
      return encounters.filter((e) => !exclude(e) && locks(e, player));
    },
    lockedFamilies,
    // For views that belong to no player (the Pokédex, the Kampf & Fang
    // picker): a family counts as locked only once no player may catch it.
    lockedForAll(): Set<number> {
      const [first, ...rest] = players;
      if (first === undefined) return new Set();
      const others = rest.map(lockedFamilies);
      return new Set([...lockedFamilies(first)].filter((id) => others.every((set) => set.has(id))));
    },
  };
}
