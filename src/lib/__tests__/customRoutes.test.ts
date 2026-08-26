import { describe, it, expect } from "vitest";
import { isCustomRouteId, mergeRoutes, customRouteToRoute } from "@/lib/customRoutes";
import type { Route } from "@/lib/data";

function packRoute(id: number, name: string): Route {
  return { id, names: { de: name, en: name, fr: name, es: name, it: name }, type: "route" };
}

const PACK = [packRoute(3, "Route 1"), packRoute(5, "Route 22"), packRoute(6, "Route 2")];

function custom(routeId: number, name: string, afterRouteId: number | null, type = "route") {
  return { routeId, name, type, afterRouteId };
}

describe("isCustomRouteId", () => {
  it("splits on the sign, so pack ids can never be mistaken for custom ones", () => {
    expect(isCustomRouteId(-1)).toBe(true);
    expect(isCustomRouteId(3)).toBe(false);
    expect(isCustomRouteId(0)).toBe(false);
  });
});

describe("customRouteToRoute", () => {
  it("fans the single name out to every language and marks the route custom", () => {
    const route = customRouteToRoute({ routeId: -1, name: "Safari Extra", type: "static" });
    expect(route.custom).toBe(true);
    expect(route.type).toBe("static");
    expect(route.names.de).toBe("Safari Extra");
    expect(route.names.it).toBe("Safari Extra");
  });

  it("falls back to a normal route for an unknown type string", () => {
    expect(customRouteToRoute({ routeId: -1, name: "x", type: "nonsense" }).type).toBe("route");
  });

  it("carries the hidden flag, and defaults it to false", () => {
    // `hidden` is what keeps a free-team slot off the Encounter tab; a lost
    // flag would put six fake routes in front of the player.
    expect(customRouteToRoute({ routeId: -1, name: "Team 1", type: "route", hidden: true }).hidden).toBe(true);
    expect(customRouteToRoute({ routeId: -2, name: "Safari", type: "route" }).hidden).toBe(false);
  });
});

describe("mergeRoutes", () => {
  it("returns the pack untouched when there is nothing to splice", () => {
    expect(mergeRoutes(PACK, []).map((r) => r.id)).toEqual([3, 5, 6]);
  });

  it("inserts after the anchor", () => {
    const merged = mergeRoutes(PACK, [custom(-1, "Extra", 5)]);
    expect(merged.map((r) => r.id)).toEqual([3, 5, -1, 6]);
  });

  it("puts a null anchor at the very top", () => {
    expect(mergeRoutes(PACK, [custom(-1, "Extra", null)]).map((r) => r.id)).toEqual([-1, 3, 5, 6]);
  });

  it("appends when the anchor is gone from the pack", () => {
    // A pack update can drop a route; the custom one must survive it.
    expect(mergeRoutes(PACK, [custom(-1, "Extra", 999)]).map((r) => r.id)).toEqual([3, 5, 6, -1]);
  });

  it("keeps creation order for two routes sharing an anchor", () => {
    // Naively splicing at anchor+1 each time would push the first sibling
    // down and list them backwards.
    const merged = mergeRoutes(PACK, [custom(-1, "First", 3), custom(-2, "Second", 3)]);
    expect(merged.map((r) => r.id)).toEqual([3, -1, -2, 5, 6]);
  });

  it("keeps creation order for two routes pinned to the top", () => {
    const merged = mergeRoutes(PACK, [custom(-1, "First", null), custom(-2, "Second", null)]);
    expect(merged.map((r) => r.id)).toEqual([-1, -2, 3, 5, 6]);
  });

  it("can anchor a custom route to another custom route", () => {
    const merged = mergeRoutes(PACK, [custom(-1, "First", 3), custom(-2, "Second", -1)]);
    expect(merged.map((r) => r.id)).toEqual([3, -1, -2, 5, 6]);
  });

  it("does not mutate the pack array it was given", () => {
    const pack = [...PACK];
    mergeRoutes(pack, [custom(-1, "Extra", 3)]);
    expect(pack.map((r) => r.id)).toEqual([3, 5, 6]);
  });
});
