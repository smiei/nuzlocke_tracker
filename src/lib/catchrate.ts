// Gen 3 (RSE/FRLG) capture mechanics. The HP term of the catch formula only
// depends on the current/max HP *ratio*, so a percentage input is exact -
// no need to reconstruct absolute HP values from base stats.
//
//   a = (3 - 2*hpFrac)/3 * baseRate * ballBonus * statusBonus
//   a >= 255  -> guaranteed catch
//   otherwise b = 1048560 / (16711680/a)^(1/4), P(catch) = (b/65536)^4

export type BallId =
  | "poke"
  | "great"
  | "ultra"
  | "master"
  | "safari"
  | "net"
  | "nest"
  | "dive"
  | "repeat"
  | "timer"
  | "luxury"
  | "premier";

export type StatusId = "none" | "sleep" | "freeze" | "paralysis" | "poison" | "burn";

// Display order: the three standard balls first, then the situational ones.
export const BALL_IDS: BallId[] = [
  "poke",
  "great",
  "ultra",
  "master",
  "safari",
  "net",
  "nest",
  "dive",
  "repeat",
  "timer",
  "luxury",
  "premier",
];

export const STATUS_IDS: StatusId[] = ["none", "sleep", "freeze", "paralysis", "poison", "burn"];

export const STATUS_MULTIPLIERS: Record<StatusId, number> = {
  none: 1,
  sleep: 2,
  freeze: 2,
  paralysis: 1.5,
  poison: 1.5,
  burn: 1.5,
};

export function ballMultiplier(
  ball: BallId,
  ctx: { types: string[]; level: number; turn: number },
): number {
  switch (ball) {
    case "great":
    case "safari":
      return 1.5;
    case "ultra":
      return 2;
    case "net":
      return ctx.types.includes("water") || ctx.types.includes("bug") ? 3 : 1;
    case "nest":
      return ctx.level < 40 ? Math.max(1, (40 - ctx.level) / 10) : 1;
    case "dive":
      return 3.5;
    case "repeat":
      return 3;
    case "timer":
      return Math.min(4, (ctx.turn + 10) / 10);
    // poke, master (handled as guaranteed), luxury, premier
    default:
      return 1;
  }
}

export type CatchInput = {
  baseRate: number;
  hpPercent: number; // 1-100
  level: number; // 1-100
  ball: BallId;
  status: StatusId;
  types: string[];
  turn: number; // battle turn, only relevant for the Timer Ball
};

export type CatchResult = {
  guaranteed: boolean;
  chance: number; // per-throw probability, 0..1
  a: number;
  ballBonus: number;
  statusBonus: number;
};

export function computeCatchChance(input: CatchInput): CatchResult {
  const hpFrac = Math.min(100, Math.max(1, input.hpPercent)) / 100;
  const ballBonus = ballMultiplier(input.ball, {
    types: input.types,
    level: input.level,
    turn: input.turn,
  });
  const statusBonus = STATUS_MULTIPLIERS[input.status];

  if (input.ball === "master") {
    return { guaranteed: true, chance: 1, a: 255, ballBonus: 1, statusBonus };
  }

  const a = Math.max(
    1,
    ((3 - 2 * hpFrac) / 3) * input.baseRate * ballBonus * statusBonus,
  );

  if (a >= 255) {
    return { guaranteed: true, chance: 1, a: 255, ballBonus, statusBonus };
  }

  const b = Math.min(65535, Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a))));
  const chance = Math.pow(b / 65536, 4);
  return { guaranteed: false, chance, a, ballBonus, statusBonus };
}
