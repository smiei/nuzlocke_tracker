// Capture mechanics per generation. All formulas only depend on the
// current/max HP *ratio*, so a percentage input is exact.
//
// Gen 1 (RBY):   rand(0..B) ball-specific; status can auto-catch; closed-form
//                approximation from Bulbapedia's derivation.
// Gen 2 (GSC):   value = rate * ballMod * hpFactor + statusBonus, catch if
//                rand(0..255) < value. Only sleep/freeze give a bonus (+10).
// Gen 3/4:       a = hpFactor * rate * ballMod * statusMod; a >= 255 is a
//                guaranteed catch, otherwise the shake-check formula applies.

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
  | "premier"
  | "level"
  | "lure"
  | "moon"
  | "friend"
  | "love"
  | "fast"
  | "park"
  | "quick"
  | "dusk";

export type StatusId = "none" | "sleep" | "freeze" | "paralysis" | "poison" | "burn";

export const STATUS_IDS: StatusId[] = ["none", "sleep", "freeze", "paralysis", "poison", "burn"];

// Display order: the standard balls first, then the situational ones.
const BALLS_GEN1: BallId[] = ["poke", "great", "ultra", "master", "safari"];
const BALLS_GEN2: BallId[] = [
  "poke",
  "great",
  "ultra",
  "master",
  "level",
  "lure",
  "moon",
  "friend",
  "love",
  "fast",
  "park",
];
const BALLS_GEN3: BallId[] = [
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
const BALLS_GEN4: BallId[] = [
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
  "quick",
  "dusk",
  "luxury",
  "premier",
];

export function getBallIdsForGeneration(generation: number): BallId[] {
  if (generation === 1) return BALLS_GEN1;
  if (generation === 2) return BALLS_GEN2;
  if (generation >= 4) return BALLS_GEN4;
  return BALLS_GEN3;
}

const STATUS_MULTIPLIERS: Record<StatusId, number> = {
  none: 1,
  sleep: 2,
  freeze: 2,
  paralysis: 1.5,
  poison: 1.5,
  burn: 1.5,
};

// Gen 3/4 ball multipliers (situational balls assume their condition holds -
// noted in the UI). Gen 4 additions: Quick ×4 on the first turn, Dusk ×3.5
// (night/cave assumed).
function ballMultiplierGen34(
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
    case "quick":
      return ctx.turn === 1 ? 4 : 1;
    case "dusk":
      return 3.5;
    // poke, master (handled as guaranteed), luxury, premier
    default:
      return 1;
  }
}

// Gen 2 multipliers; the conditional balls assume a favorable condition
// (noted in the UI). Friend Ball has no catch bonus at all.
function ballMultiplierGen2(ball: BallId): number {
  switch (ball) {
    case "great":
    case "park":
      return 1.5;
    case "ultra":
      return 2;
    case "lure":
      return 3;
    case "level":
    case "moon":
    case "fast":
      return 4;
    case "love":
      return 8;
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
  turn: number; // battle turn (Timer/Quick Ball)
};

export type CatchResult = {
  guaranteed: boolean;
  chance: number; // per-throw probability, 0..1
  // Preformatted factors for the details line ("×2", "+10", ...).
  ballText: string;
  statusText: string;
};

function computeGen1(input: CatchInput): CatchResult {
  if (input.ball === "master") {
    return { guaranteed: true, chance: 1, ballText: "×1", statusText: "×1" };
  }
  const hpFrac = Math.min(100, Math.max(1, input.hpPercent)) / 100;
  const B = input.ball === "great" ? 200 : input.ball === "poke" ? 255 : 150; // ultra/safari
  const S =
    input.status === "sleep" || input.status === "freeze"
      ? 25
      : input.status === "none"
        ? 0
        : 12;
  const den = input.ball === "great" ? 8 : 12;
  const f = Math.min(255, Math.floor((255 * 4) / (den * hpFrac)));
  const statusPart = Math.min(1, S / (B + 1));
  const ratePart =
    (Math.max(0, Math.min(input.baseRate, B - S) + 1) / (B + 1)) * ((f + 1) / 256);
  const chance = Math.min(1, statusPart + ratePart);
  return {
    guaranteed: false,
    chance,
    ballText: `≈×${(255 / B).toFixed(2)}`,
    statusText: `+${S}`,
  };
}

function computeGen2(input: CatchInput): CatchResult {
  if (input.ball === "master") {
    return { guaranteed: true, chance: 1, ballText: "×1", statusText: "+0" };
  }
  const hpFrac = Math.min(100, Math.max(1, input.hpPercent)) / 100;
  const mult = ballMultiplierGen2(input.ball);
  const bonus = input.status === "sleep" || input.status === "freeze" ? 10 : 0;
  const value = Math.min(
    255,
    Math.max(1, Math.floor(((3 - 2 * hpFrac) / 3) * input.baseRate * mult)) + bonus,
  );
  return {
    guaranteed: false,
    chance: value / 256,
    ballText: `×${mult}`,
    statusText: `+${bonus}`,
  };
}

function computeGen34(input: CatchInput): CatchResult {
  const hpFrac = Math.min(100, Math.max(1, input.hpPercent)) / 100;
  const ballBonus = ballMultiplierGen34(input.ball, {
    types: input.types,
    level: input.level,
    turn: input.turn,
  });
  const statusBonus = STATUS_MULTIPLIERS[input.status];
  const ballText = `×${ballBonus}`;
  const statusText = `×${statusBonus}`;

  if (input.ball === "master") {
    return { guaranteed: true, chance: 1, ballText: "×1", statusText };
  }

  const a = Math.max(1, ((3 - 2 * hpFrac) / 3) * input.baseRate * ballBonus * statusBonus);
  if (a >= 255) {
    return { guaranteed: true, chance: 1, ballText, statusText };
  }

  const b = Math.min(65535, Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a))));
  const chance = Math.pow(b / 65536, 4);
  return { guaranteed: false, chance, ballText, statusText };
}

export function computeCatchChance(generation: number, input: CatchInput): CatchResult {
  if (generation === 1) return computeGen1(input);
  if (generation === 2) return computeGen2(input);
  return computeGen34(input);
}
