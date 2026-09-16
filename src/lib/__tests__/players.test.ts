import { describe, it, expect } from "vitest";
import { Player, RunMode } from "@/generated/prisma/enums";
import { clampPlayerCount, comparePlayers, runPlayers } from "@/lib/players";

describe("runPlayers", () => {
  it("is Player 1 alone in a Classic run, whatever the count says", () => {
    expect(runPlayers(RunMode.CLASSIC, 4)).toEqual([Player.PLAYER1]);
  });

  it("lists the first n players of a SoulLink run", () => {
    expect(runPlayers(RunMode.SOULLINK, 2)).toEqual([Player.PLAYER1, Player.PLAYER2]);
    expect(runPlayers(RunMode.SOULLINK, 4)).toEqual([
      Player.PLAYER1,
      Player.PLAYER2,
      Player.PLAYER3,
      Player.PLAYER4,
    ]);
  });

  it("falls back to two players for a count out of range", () => {
    expect(runPlayers(RunMode.SOULLINK, 1)).toHaveLength(2);
    expect(runPlayers(RunMode.SOULLINK, 7)).toHaveLength(2);
  });
});

describe("clampPlayerCount", () => {
  it("keeps 2-4 and replaces everything else with 2", () => {
    expect([2, 3, 4].map(clampPlayerCount)).toEqual([2, 3, 4]);
    expect([0, 5, 2.5, "3", null, undefined].map(clampPlayerCount)).toEqual([2, 2, 2, 2, 2, 2]);
  });
});

describe("comparePlayers", () => {
  it("sorts by player number", () => {
    const sorted = [Player.PLAYER3, Player.PLAYER1, Player.PLAYER4, Player.PLAYER2].sort(comparePlayers);
    expect(sorted).toEqual([Player.PLAYER1, Player.PLAYER2, Player.PLAYER3, Player.PLAYER4]);
  });
});
