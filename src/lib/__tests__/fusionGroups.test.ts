import { describe, it, expect } from "vitest";
import {
  groupSoulLinks,
  groupTeamPositions,
  isFoldedDonor,
  teamLinkIds,
  teamSlotsNeeded,
  type GroupableEncounter,
} from "@/lib/fusionGroups";

describe("teamLinkIds", () => {
  it("counts both routes of a crosswise fusion even though only one holds the slot", () => {
    const links = [
      { id: 132, teamPosition: 0, encounters: [enc(246, 132, "P1"), enc(249, 132, "P2", 248)] },
      { id: 133, teamPosition: null, encounters: [enc(247, 133, "P1", 246), enc(248, 133, "P2")] },
      { id: 134, teamPosition: null, encounters: [enc(250, 134, "P1"), enc(251, 134, "P2")] },
    ];
    expect([...teamLinkIds(links)].sort()).toEqual([132, 133]);
  });

  it("gives every link of a group the group's lowest slot", () => {
    const links = [
      { id: 10, teamPosition: 4, encounters: [enc(1, 10, "P1")] },
      { id: 20, teamPosition: 2, encounters: [enc(2, 20, "P1", 1)] },
      { id: 30, teamPosition: null, encounters: [enc(3, 30, "P1")] },
    ];
    expect(Object.fromEntries(groupTeamPositions(links))).toEqual({ 10: 2, 20: 2, 30: null });
  });

  it("is just the links with a slot when nothing is fused", () => {
    const links = [
      { id: 1, teamPosition: 3, encounters: [enc(1, 1, "P1")] },
      { id: 2, teamPosition: null, encounters: [enc(2, 2, "P1")] },
    ];
    expect([...teamLinkIds(links)]).toEqual([1]);
  });
});

const enc = (
  id: number,
  soulLinkId: number,
  player: string,
  fusedIntoId: number | null = null,
): GroupableEncounter => ({ id, soulLinkId, player, fusedIntoId });

describe("groupSoulLinks", () => {
  it("leaves every link on its own when nothing is fused", () => {
    const encounters = [enc(1, 10, "P1"), enc(2, 10, "P2"), enc(3, 20, "P1"), enc(4, 20, "P2")];
    expect(groupSoulLinks([10, 20], encounters)).toEqual([[10], [20]]);
  });

  it("joins the two routes both players fused crosswise into ONE group", () => {
    // The reported case: P1 fuses Starter(head)+Route 1(body), P2 fuses
    // Route 1(head)+Starter(body).
    const encounters = [
      enc(246, 132, "P1"), // Venusaur, Starter - host
      enc(249, 132, "P2", 248), // Butterfree, Starter - donor into Beedrill
      enc(247, 133, "P1", 246), // Squirtle, Route 1 - donor into Venusaur
      enc(248, 133, "P2"), // Beedrill, Route 1 - host
    ];
    expect(groupSoulLinks([132, 133], encounters)).toEqual([[132, 133]]);
  });

  it("follows fusions transitively across players", () => {
    // P1 fuses route 1+3, P2 fuses route 2+3: all three routes are one group.
    const encounters = [
      enc(1, 1, "P1"),
      enc(2, 1, "P2"),
      enc(3, 2, "P1"),
      enc(4, 2, "P2"),
      enc(5, 3, "P1", 1),
      enc(6, 3, "P2", 4),
      enc(7, 4, "P1"),
      enc(8, 4, "P2"),
    ];
    expect(groupSoulLinks([1, 2, 3, 4], encounters)).toEqual([[1, 2, 3], [4]]);
  });

  it("keeps the caller's order for groups and within a group", () => {
    const encounters = [enc(1, 30, "P1"), enc(2, 10, "P1", 1), enc(3, 20, "P1")];
    expect(groupSoulLinks([20, 30, 10], encounters)).toEqual([[20], [30, 10]]);
  });

  it("ignores a fusion edge to a link that isn't in the list", () => {
    const encounters = [enc(1, 10, "P1"), enc(2, 99, "P1", 1)];
    expect(groupSoulLinks([10], encounters)).toEqual([[10]]);
  });
});

describe("isFoldedDonor", () => {
  it("is true only when the host is inside the same group", () => {
    const donor = enc(2, 20, "P1", 1);
    expect(isFoldedDonor(donor, new Set([1, 2]))).toBe(true);
    expect(isFoldedDonor(donor, new Set([2]))).toBe(false);
    expect(isFoldedDonor(enc(1, 10, "P1"), new Set([1, 2]))).toBe(false);
  });
});

describe("teamSlotsNeeded", () => {
  it("needs one slot for an ordinary pair", () => {
    expect(teamSlotsNeeded([enc(1, 10, "P1"), enc(2, 10, "P2")])).toBe(1);
  });

  it("needs one slot once both players fused the same two routes", () => {
    const group = [enc(246, 132, "P1"), enc(249, 132, "P2", 248), enc(247, 133, "P1", 246), enc(248, 133, "P2")];
    expect(teamSlotsNeeded(group)).toBe(1);
  });

  it("needs two slots while only one player has fused", () => {
    // P1: one fusion; P2: still two separate Pokémon.
    const group = [enc(1, 10, "P1"), enc(2, 10, "P2"), enc(3, 20, "P1", 1), enc(4, 20, "P2")];
    expect(teamSlotsNeeded(group)).toBe(2);
  });

  it("counts a Classic fusion as a single slot", () => {
    expect(teamSlotsNeeded([enc(1, 10, "P1"), enc(2, 20, "P1", 1)])).toBe(1);
  });
});
