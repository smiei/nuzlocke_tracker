import { describe, it, expect } from "vitest";
import { Player } from "@/generated/prisma/enums";
import { isRouteDone, computeRouteProgress, computeLevelCapProgress, eliteFourIndex } from "@/lib/progress";

const routes = [
  { id: 1, type: "route" },
  { id: 2, type: "route" },
  { id: 3, type: "route", postgame: true },
  { id: 4, type: "static" },
];

describe("isRouteDone", () => {
  it("Classic: done once player 1 has an entry", () => {
    const encounters = [{ routeId: 1, player: Player.PLAYER1 }];
    expect(isRouteDone(routes[0], encounters, true)).toBe(true);
    expect(isRouteDone(routes[1], encounters, true)).toBe(false);
  });

  it("SoulLink: done only once both players have an entry", () => {
    const encounters = [{ routeId: 1, player: Player.PLAYER1 }];
    expect(isRouteDone(routes[0], encounters, false)).toBe(false);
    encounters.push({ routeId: 1, player: Player.PLAYER2 });
    expect(isRouteDone(routes[0], encounters, false)).toBe(true);
  });
});

describe("computeRouteProgress", () => {
  it("counts only non-postgame trackable routes, ignoring statics by default", () => {
    const encounters = [{ routeId: 1, player: Player.PLAYER1 }];
    // statics off -> route 4 excluded; route 3 excluded as postgame -> total 2 (routes 1,2)
    expect(computeRouteProgress(routes, encounters, true, false)).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
  });

  it("includes statics when the rule is on", () => {
    const encounters = [{ routeId: 1, player: Player.PLAYER1 }];
    // statics on -> routes 1,2,4 count (3 is still excluded as postgame)
    expect(computeRouteProgress(routes, encounters, true, true)).toEqual({
      done: 1,
      total: 3,
      percent: 33,
    });
  });

  it("returns 0% for an empty route list", () => {
    expect(computeRouteProgress([], [], true, false)).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("computeLevelCapProgress", () => {
  it("counts defeated entries out of all entries", () => {
    const items = [{ defeated: true }, { defeated: false }, { defeated: true }];
    expect(computeLevelCapProgress(items)).toEqual({ done: 2, total: 3, percent: 67 });
  });

  it("returns 0% for an empty list", () => {
    expect(computeLevelCapProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("eliteFourIndex", () => {
  it("returns the array index of the first Elite Four entry", () => {
    const levelCaps = [
      { location: { de: "Marmoria City", en: "Pewter City" } },
      { location: { de: "Azuria City", en: "Cerulean City" } },
      { location: { de: "Top 4", en: "Elite Four" } },
      { location: { de: "Top 4", en: "Elite Four" } },
    ];
    expect(eliteFourIndex(levelCaps)).toBe(2);
  });

  it("returns null when there is no Elite Four entry", () => {
    const levelCaps = [{ location: { de: "Marmoria City", en: "Pewter City" } }];
    expect(eliteFourIndex(levelCaps)).toBeNull();
  });
});

describe("computeRouteProgress with free-team slots", () => {
  // A hidden route exists only to hold a team member. Counting it would make
  // the Encounter tab's denominator climb every time somebody is added to the
  // team, which is the opposite of progress.
  const routes = [
    { id: 1, type: "route" },
    { id: 2, type: "route" },
    { id: -1, type: "route", hidden: true },
    { id: -2, type: "route", hidden: true },
  ];

  it("leaves hidden routes out of the total", () => {
    const stats = computeRouteProgress(routes, [], true, true);
    expect(stats.total).toBe(2);
  });

  it("leaves an encounter on a hidden route out of the count", () => {
    const encounters = [{ routeId: -1, player: Player.PLAYER1 }];
    const stats = computeRouteProgress(routes, encounters, true, true);
    expect(stats.done).toBe(0);
    expect(stats.total).toBe(2);
    expect(stats.percent).toBe(0);
  });
});
