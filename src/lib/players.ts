import { Player, RunMode } from "@/generated/prisma/enums";

// Who plays a run. A SoulLink run has 2-4 players (Run.playerCount, fixed at
// creation like the mode), a Classic run exactly one. Everything that used to
// write out [PLAYER1, PLAYER2] asks this instead, so a three- or four-player
// run needs no special case anywhere: every rule that was "both players" is
// "every player of the run" - a route is done once each has an entry, a link
// forms once each has caught, and a death takes all of them.

export const ALL_PLAYERS = [Player.PLAYER1, Player.PLAYER2, Player.PLAYER3, Player.PLAYER4] as const;

export const MIN_SOULLINK_PLAYERS = 2;
export const MAX_SOULLINK_PLAYERS = ALL_PLAYERS.length;

// Anything out of range - a hand-edited DB row, a backup from somewhere else -
// falls back to the two-player run every run was before this existed.
export function clampPlayerCount(value: unknown): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_SOULLINK_PLAYERS &&
    value <= MAX_SOULLINK_PLAYERS
    ? value
    : MIN_SOULLINK_PLAYERS;
}

export function runPlayers(mode: RunMode, playerCount: number): Player[] {
  if (mode === RunMode.CLASSIC) return [Player.PLAYER1];
  return ALL_PLAYERS.slice(0, clampPlayerCount(playerCount));
}

// Player 1 before Player 2 before ... - the order every per-player list uses.
export function comparePlayers(a: Player, b: Player): number {
  return ALL_PLAYERS.indexOf(a) - ALL_PLAYERS.indexOf(b);
}
