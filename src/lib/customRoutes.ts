// Client-safe half of the custom-route feature: everything the browser (and
// the unit tests) may touch, with no Prisma and no fs import. The database
// side - reading a run's rows and looking one up - lives in runRoutes.ts.
//
// The split is also forced by actions.ts carrying "use server": such a module
// may only export async functions, so a plain `export const` cannot live
// there.
import type { Route, RouteType } from "@/lib/data";
import { LANGS } from "@/lib/i18n/dictionary";

// Length cap on a hand-added route's name, enforced by the action and by the
// input that feeds it.
export const CUSTOM_ROUTE_NAME_MAX = 60;

// Game-pack route ids are positive and frozen forever; a run's own additions
// are handed negative ids precisely so the two ranges can never meet. That
// makes the sign the entire test.
export function isCustomRouteId(routeId: number): boolean {
  return routeId < 0;
}

// The shape the merge needs, so this module never has to name a Prisma type.
export type CustomRouteInput = {
  routeId: number;
  name: string;
  type: string;
  afterRouteId: number | null;
};

// A custom route has one free-text name, but Route.names is localized and
// localizeName() falls back lang -> en -> de. Filling every language with the
// same string means routeName() needs no special case anywhere.
export function customRouteToRoute(row: Omit<CustomRouteInput, "afterRouteId">): Route {
  const names = Object.fromEntries(LANGS.map((lang) => [lang, row.name])) as Route["names"];
  return {
    id: row.routeId,
    names,
    type: (row.type === "static" ? "static" : "route") satisfies RouteType,
    custom: true,
  };
}

// Splices `customRoutes` into `packRoutes` at their anchors. `customRoutes`
// must arrive in creation order.
//
// The anchor is the id of the route a custom one follows (null = very top),
// not an index: the pack's own array order is display order and does get
// reshuffled - correcting it is what the debug export exists for - and an
// index would silently point somewhere else afterwards.
//
// `placed` is what keeps two routes sharing one anchor in the order they were
// added. Inserting each one directly after its anchor would push the previous
// sibling down, so adding A then B under Route 1 would list B, A. Counting how
// many have already landed on that anchor and inserting past them fixes it,
// and still lets a custom route anchor to another custom route.
//
// An anchor that no longer resolves (a pack update dropped that route)
// appends rather than losing the route.
export function mergeRoutes(packRoutes: Route[], customRoutes: CustomRouteInput[]): Route[] {
  const merged = [...packRoutes];
  const placed = new Map<number | null, number>();
  for (const row of customRoutes) {
    const route = customRouteToRoute(row);
    const siblings = placed.get(row.afterRouteId) ?? 0;
    if (row.afterRouteId === null) {
      merged.splice(siblings, 0, route);
    } else {
      const at = merged.findIndex((existing) => existing.id === row.afterRouteId);
      if (at === -1) {
        merged.push(route);
        continue;
      }
      merged.splice(at + 1 + siblings, 0, route);
    }
    placed.set(row.afterRouteId, siblings + 1);
  }
  return merged;
}
