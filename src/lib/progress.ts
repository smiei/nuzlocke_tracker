import { Player } from "@/generated/prisma/enums";
import type { LevelCap } from "@/lib/data";

export type ProgressStats = { done: number; total: number; percent: number };

type RouteLike = { id: number; type: string; postgame?: boolean; hidden?: boolean };
type EncounterLike = { routeId: number; player: Player };

// A route counts as "done" once every player slot has an entry (any status):
// both players in SoulLink, player 1 in Classic.
export function isRouteDone(
  route: RouteLike,
  encounters: EncounterLike[],
  isClassic: boolean,
): boolean {
  const p1 = encounters.some((e) => e.routeId === route.id && e.player === Player.PLAYER1);
  if (isClassic) return p1;
  const p2 = encounters.some((e) => e.routeId === route.id && e.player === Player.PLAYER2);
  return p1 && p2;
}

function toPercent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

// Overall encounter completion for the Tracker tab's progress bar - always
// against every trackable, non-post-game route, independent of any "open
// only" filter the caller might apply to its own rendered list.
export function computeRouteProgress(
  routes: RouteLike[],
  encounters: EncounterLike[],
  isClassic: boolean,
  statics: boolean,
): ProgressStats {
  // `hidden` routes are free-team slots, not places the run goes: counting
  // them would make the denominator grow every time a team member is added.
  const visible = routes.filter((r) => !r.hidden);
  const trackable = statics ? visible : visible.filter((r) => r.type === "route");
  const nonPostgame = trackable.filter((r) => !r.postgame);
  const done = nonPostgame.filter((r) => isRouteDone(r, encounters, isClassic)).length;
  return { done, total: nonPostgame.length, percent: toPercent(done, nonPostgame.length) };
}

// Journey tab completion: how many boss fights (gyms, rivals, Elite Four, ...)
// have been checked off, out of all of them.
export function computeLevelCapProgress(items: { defeated: boolean }[]): ProgressStats {
  const done = items.filter((i) => i.defeated).length;
  return { done, total: items.length, percent: toPercent(done, items.length) };
}

// Index of the first Elite Four entry, for a progress-bar marker showing
// "everything up to here is regular trainers." `location.en === "Elite Four"`
// reliably and exclusively identifies the Elite Four + Champion block (always
// 5 contiguous entries) across every game pack's levelcaps.json, so this
// needs no dedicated data field.
export function eliteFourIndex(levelCaps: Pick<LevelCap, "location">[]): number | null {
  const idx = levelCaps.findIndex((c) => c.location.en === "Elite Four");
  return idx === -1 ? null : idx;
}
