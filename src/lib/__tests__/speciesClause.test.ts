import { describe, it, expect } from "vitest";
import { EncounterStatus, Player } from "@/generated/prisma/enums";
import {
  boundRouteMap,
  clauseView,
  formedRouteIds,
  type ClauseEncounter,
  type ClauseRules,
} from "@/lib/speciesClause";

const { PLAYER1: P1, PLAYER2: P2, PLAYER3: P3 } = Player;
const TWO = [P1, P2];
const THREE = [P1, P2, P3];
const CHARMANDER = 4;
const BULBASAUR = 1;

let nextId = 1;
const enc = (
  routeId: number,
  player: Player,
  familyId: number,
  extra: Partial<ClauseEncounter> = {},
): ClauseEncounter => ({
  id: nextId++,
  routeId,
  player,
  familyId,
  status: EncounterStatus.CAUGHT,
  shiny: false,
  isFusionBody: false,
  fusedIntoId: null,
  ...extra,
});

const rules = (overrides: Partial<ClauseRules> = {}): ClauseRules => ({
  speciesClause: true,
  shinyClause: true,
  fusionLocksBothFamilies: true,
  speciesClausePerPlayer: false,
  speciesClauseLinkedLocksAll: false,
  ...overrides,
});
const PER_PLAYER = rules({ speciesClausePerPlayer: true });
const YOUTUBER = rules({ speciesClausePerPlayer: true, speciesClauseLinkedLocksAll: true });

describe("the run-wide clause (today's rule)", () => {
  it("locks a family for everyone, whatever happened to the encounter", () => {
    const view = clauseView([enc(5, P1, CHARMANDER, { status: EncounterStatus.FLED })], {
      rules: rules(),
      players: TWO,
    });
    expect(view.lockedFamilies(P2).has(CHARMANDER)).toBe(true);
  });

  it("locks nothing with the clause switched off", () => {
    const view = clauseView([enc(5, P1, CHARMANDER)], { rules: rules({ speciesClause: false }), players: TWO });
    expect(view.lockedFamilies(P1).size).toBe(0);
  });

  it("lets a shiny catch lock nothing", () => {
    const view = clauseView([enc(5, P1, CHARMANDER, { shiny: true })], { rules: rules(), players: TWO });
    expect(view.lockedFamilies(P2).has(CHARMANDER)).toBe(false);
  });
});

describe("per player", () => {
  it("locks only the player who had the encounter, caught or not", () => {
    const view = clauseView(
      [enc(5, P1, CHARMANDER, { status: EncounterStatus.FLED }), enc(6, P1, BULBASAUR), enc(6, P2, 16)],
      { rules: PER_PLAYER, players: TWO },
    );
    expect(view.lockedFamilies(P1).has(CHARMANDER)).toBe(true);
    expect(view.lockedFamilies(P2).has(CHARMANDER)).toBe(false);
    // Even a formed link only locks its own players without the second rule.
    expect(view.lockedFamilies(P2).has(BULBASAUR)).toBe(false);
  });

  it("behaves like the run-wide clause in a solo run", () => {
    const view = clauseView([enc(5, P1, CHARMANDER)], { rules: PER_PLAYER, players: [P1] });
    expect(view.lockedFamilies(P1).has(CHARMANDER)).toBe(true);
  });
});

describe("per player, caught links lock for everyone", () => {
  it("the reported example: player 1's Charmander flees - player 2 may still catch one", () => {
    const encounters = [enc(5, P1, CHARMANDER, { status: EncounterStatus.FLED }), enc(5, P2, 16)];
    const view = clauseView(encounters, { rules: YOUTUBER, players: TWO });
    expect(view.lockedFamilies(P1).has(CHARMANDER)).toBe(true);
    expect(view.lockedFamilies(P2).has(CHARMANDER)).toBe(false);
  });

  it("...but had the link formed, Charmander is used up for everyone", () => {
    const view = clauseView([enc(5, P1, CHARMANDER), enc(5, P2, 16)], { rules: YOUTUBER, players: TWO });
    expect(view.lockedFamilies(P2).has(CHARMANDER)).toBe(true);
  });

  it("needs every player of a three-player run to have caught", () => {
    const pending = [enc(5, P1, CHARMANDER), enc(5, P2, 16)];
    expect(clauseView(pending, { rules: YOUTUBER, players: THREE }).lockedFamilies(P3).has(CHARMANDER)).toBe(false);
    const formed = [...pending, enc(5, P3, 19)];
    expect(clauseView(formed, { rules: YOUTUBER, players: THREE }).lockedFamilies(P3).has(CHARMANDER)).toBe(true);
  });

  it("does not count a link that never formed", () => {
    const view = clauseView(
      [enc(5, P1, CHARMANDER), enc(5, P2, 16, { status: EncounterStatus.KILLED })],
      { rules: YOUTUBER, players: TWO },
    );
    expect(view.lockedFamilies(P2).has(CHARMANDER)).toBe(false);
    expect(view.lockedFamilies(P2).has(16)).toBe(true);
    expect(view.lockedFamilies(P1).has(16)).toBe(false);
  });

  it("still lets a shiny catch lock nothing", () => {
    const view = clauseView([enc(5, P1, CHARMANDER, { shiny: true }), enc(5, P2, 16)], {
      rules: YOUTUBER,
      players: TWO,
    });
    expect(view.lockedFamilies(P1).has(CHARMANDER)).toBe(false);
  });

  it("counts a wild-caught fusion body with its head's route", () => {
    const head = enc(5, P1, CHARMANDER);
    const body = enc(-1, P1, BULBASAUR, { isFusionBody: true, fusedIntoId: head.id });
    const view = clauseView([head, body, enc(5, P2, 16)], { rules: YOUTUBER, players: TWO });
    expect(view.lockedFamilies(P2).has(BULBASAUR)).toBe(true);
    const unlocked = clauseView([head, body, enc(5, P2, 16)], {
      rules: { ...YOUTUBER, fusionLocksBothFamilies: false },
      players: TWO,
    });
    expect(unlocked.lockedFamilies(P1).has(BULBASAUR)).toBe(false);
  });

  it("counts a split-off body with the route its link is bound to", () => {
    const split = enc(-2, P1, BULBASAUR);
    const encounters = [enc(5, P1, CHARMANDER), enc(5, P2, 16), split];
    const boundRouteOf = boundRouteMap([
      { id: 50, routeId: 5, boundToId: null },
      { id: 51, routeId: -2, boundToId: 50 },
    ]);
    expect(clauseView(encounters, { rules: YOUTUBER, players: TWO, boundRouteOf }).lockedFamilies(P2).has(BULBASAUR)).toBe(true);
    expect(clauseView(encounters, { rules: YOUTUBER, players: TWO }).lockedFamilies(P2).has(BULBASAUR)).toBe(false);
  });
});

describe("views without a player", () => {
  it("call a family locked only once no player may catch it", () => {
    const view = clauseView([enc(5, P1, CHARMANDER), enc(6, P2, CHARMANDER), enc(7, P1, BULBASAUR)], {
      rules: PER_PLAYER,
      players: TWO,
    });
    expect([...view.lockedForAll()]).toEqual([CHARMANDER]);
  });
});

describe("formedRouteIds", () => {
  it("ignores fusion bodies and needs a caught entry from every player", () => {
    const head = enc(5, P1, CHARMANDER);
    const encounters = [head, enc(-1, P2, 1, { isFusionBody: true, fusedIntoId: head.id })];
    expect([...formedRouteIds(encounters, TWO)]).toEqual([]);
    expect([...formedRouteIds([...encounters, enc(5, P2, 16)], TWO)]).toEqual([5]);
  });
});

describe("lockingEncounters", () => {
  it("leaves out what the caller excludes but still judges links on everything", () => {
    const mine = enc(5, P1, CHARMANDER);
    const view = clauseView([mine, enc(5, P2, 16)], { rules: YOUTUBER, players: TWO });
    const found = view.lockingEncounters(P1, (e) => e.id === mine.id);
    expect(found.map((e) => e.familyId)).toEqual([16]);
  });
});
