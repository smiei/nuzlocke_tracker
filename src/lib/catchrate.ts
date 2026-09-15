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
  | "dusk"
  | "heal"
  | "dream"
  | "heavy"
  | "sport"
  // Pokémon Infinite Fusion only (see BALLS_INFINITE_FUSION): one more real
  // ball, then the game's own inventions. "boost" and "glitter" are the
  // game's TRADEBALL and SHINYBALL, named after what the game displays.
  | "cherish"
  | "gender"
  | "boost"
  | "ability"
  | "virus"
  | "glitter"
  | "perfect"
  | "toxic"
  | "spark"
  | "scorch"
  | "frost"
  | "pure"
  | "status"
  | "candy"
  | "rocket"
  | "fusion";

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
  "heavy",
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

// Unova has no Safari Zone, so no Safari Ball; the Dream Ball arrives with the
// Dream World and is a guaranteed catch in Gen 5 (it was nerfed to 4x later).
const BALLS_GEN5: BallId[] = [
  "poke",
  "great",
  "ultra",
  "master",
  "net",
  "nest",
  "dive",
  "repeat",
  "timer",
  "quick",
  "dusk",
  "luxury",
  "premier",
  "heal",
  "dream",
];

// HeartGold/SoulSilver are the only Gen 4 games with Apricorn balls (Kurt) and
// the Sport Ball, so the Gen 4 list alone is not enough - the caller passes the
// game's version group.
const BALLS_GEN4_HGSS: BallId[] = [
  ...BALLS_GEN4,
  "heal",
  "park",
  "level",
  "lure",
  "moon",
  "friend",
  "love",
  "fast",
  "heavy",
  "sport",
];

// The version group of both Infinite Fusion packs - selects the game's own
// ball list and capture code (computeInfiniteFusion) instead of a generation.
export const INFINITE_FUSION_VERSION_GROUP = "infinite-fusion";

// Every ball in Infinite Fusion's own $BallTypes table
// (Data/Scripts/011_Battle/005_BallHandlers_PokeBallEffects.rb in
// github.com/infinitefusion/infinitefusion-e18), in that order: 25 real-game
// balls, then the game's 15 own. Left out: FIRECRACKER (listed there, but it
// only damages the target and never catches) and the Invisiball (an item that
// is not in the table and not obtainable).
const BALLS_INFINITE_FUSION: BallId[] = [
  "poke",
  "great",
  "safari",
  "ultra",
  "master",
  "net",
  "dive",
  "nest",
  "repeat",
  "timer",
  "luxury",
  "premier",
  "dusk",
  "heal",
  "quick",
  "cherish",
  "fast",
  "level",
  "lure",
  "heavy",
  "love",
  "friend",
  "moon",
  "sport",
  "dream",
  "gender",
  "boost",
  "ability",
  "virus",
  "glitter",
  "perfect",
  "toxic",
  "spark",
  "scorch",
  "frost",
  "pure",
  "status",
  "candy",
  "rocket",
  "fusion",
];

export function getBallIdsForGeneration(generation: number, versionGroup?: string): BallId[] {
  if (versionGroup === INFINITE_FUSION_VERSION_GROUP) return BALLS_INFINITE_FUSION;
  if (generation === 1) return BALLS_GEN1;
  if (generation === 2) return BALLS_GEN2;
  if (generation >= 5) return BALLS_GEN5;
  if (generation === 4) {
    return versionGroup === "heartgold-soulsilver"
      ? BALLS_GEN4_HGSS
      : [...BALLS_GEN4, "heal", "park"];
  }
  return BALLS_GEN3;
}

// Balls whose bonus depends on an assumed situation the calculator can't
// verify (registered species, fishing, night, etc.). The UI offers a
// "condition met?" checkbox for these; when off, they count as x1. Balls
// driven by a numeric input (nest=level, timer/quick=turn) or by type (net)
// are NOT here - their condition is entered directly.
const CONDITIONAL_BALLS = new Set<BallId>([
  "repeat",
  "dive",
  "dusk",
  "lure",
  "moon",
  "love",
  "fast",
  "park",
]);

// Infinite Fusion computes the Fast Ball from the target's base Speed instead
// of a flee-prone species list, so it needs no checkbox there.
const CONDITIONAL_BALLS_INFINITE_FUSION = new Set<BallId>([
  "repeat",
  "dive",
  "dusk",
  "lure",
  "moon",
  "love",
]);

// The Level Ball compares YOUR active Pokémon's level against the wild one's
// (both entered on the card, so it needs no checkbox): ×8 at four times the
// level or more, ×4 at twice or more, ×2 when higher at all, else ×1 - the
// same steps in Gold/Silver/Crystal, HeartGold/SoulSilver and Infinite Fusion.
// Without an own level it gives nothing.
export function levelBallMultiplier(ownLevel: number | undefined, wildLevel: number): number {
  if (ownLevel === undefined) return 1;
  if (ownLevel >= wildLevel * 4) return 8;
  if (ownLevel >= wildLevel * 2) return 4;
  if (ownLevel > wildLevel) return 2;
  return 1;
}

export function ballHasCondition(ball: BallId, versionGroup?: string): boolean {
  return versionGroup === INFINITE_FUSION_VERSION_GROUP
    ? CONDITIONAL_BALLS_INFINITE_FUSION.has(ball)
    : CONDITIONAL_BALLS.has(ball);
}

const STATUS_MULTIPLIERS: Record<StatusId, number> = {
  none: 1,
  sleep: 2,
  freeze: 2,
  paralysis: 1.5,
  poison: 1.5,
  burn: 1.5,
};

// Gen 5 raised the sleep/freeze bonus from 2x to 2.5x; everything else stayed.
const STATUS_MULTIPLIERS_GEN5: Record<StatusId, number> = {
  ...STATUS_MULTIPLIERS,
  sleep: 2.5,
  freeze: 2.5,
};

// Gen 3/4 ball multipliers (situational balls assume their condition holds -
// noted in the UI). Gen 4 additions: Quick ×4 on the first turn, Dusk ×3.5
// (night/cave assumed).
// Gen 5 changed two of the Gen 4 numbers and added two balls; everything else
// carries over, so this only overrides what differs.
function ballMultiplierGen5(
  ball: BallId,
  ctx: { types: string[]; level: number; ownLevel?: number; turn: number },
): number {
  switch (ball) {
    case "quick":
      return ctx.turn === 1 ? 5 : 1;
    case "dusk":
      return 3.5;
    // heal and premier are cosmetic; dream is handled as a guaranteed catch.
    case "heal":
      return 1;
    default:
      return ballMultiplierGen34(ball, ctx);
  }
}

function ballMultiplierGen34(
  ball: BallId,
  ctx: { types: string[]; level: number; ownLevel?: number; turn: number },
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
    // HeartGold/SoulSilver's Apricorn balls, the only Gen 4 games with them.
    // They used to fall through to ×1 here while their notes promised the
    // bonus; lure/moon/fast/love still sit behind the condition checkbox.
    case "level":
      return levelBallMultiplier(ctx.ownLevel, ctx.level);
    case "lure":
      return 3;
    case "moon":
    case "fast":
      return 4;
    case "love":
      return 8;
    // heavy shifts the catch rate itself (see effectiveBaseRate), sport is a
    // plain ball; poke, master (guaranteed), luxury, premier, heal likewise.
    default:
      return 1;
  }
}

// Gen 2 multipliers; the conditional balls assume a favorable condition
// (noted in the UI). Friend Ball has no catch bonus at all.
function ballMultiplierGen2(ball: BallId, ctx: { level: number; ownLevel?: number }): number {
  switch (ball) {
    case "great":
    case "park":
      return 1.5;
    case "ultra":
      return 2;
    case "lure":
      return 3;
    case "level":
      return levelBallMultiplier(ctx.ownLevel, ctx.level);
    case "moon":
    case "fast":
      return 4;
    case "love":
      return 8;
    default:
      return 1;
  }
}

// The Heavy Ball is the one ball that does not multiply: it ADDS to the catch
// rate by the target's weight, then the result is clamped to 1..255.
// Thresholds are identical in Gen 2 and Gen 4 (HeartGold/SoulSilver).
export function heavyBallModifier(weightKg: number | undefined): number {
  if (weightKg === undefined) return 0;
  if (weightKg <= 102.3) return -20;
  if (weightKg <= 204.7) return 0;
  if (weightKg <= 307.1) return 20;
  if (weightKg <= 409.5) return 30;
  return 40;
}

export function effectiveBaseRate(input: CatchInput): number {
  if (input.ball !== "heavy") return input.baseRate;
  return Math.min(255, Math.max(1, input.baseRate + heavyBallModifier(input.weight)));
}

export type CatchInput = {
  baseRate: number;
  // Kilograms - only the Heavy Ball uses it.
  weight?: number;
  hpPercent: number; // 1-100
  level: number; // 1-100
  ball: BallId;
  // For conditional balls: whether the assumed condition holds (default true).
  conditionMet?: boolean;
  status: StatusId;
  types: string[];
  turn: number; // battle turn (Timer/Quick Ball)
  // Your own active Pokémon's level - only the Level Ball uses it (`level` is
  // the wild Pokémon's).
  ownLevel?: number;
  // Infinite Fusion only: the target is a fusion (Fusion Ball) and its base
  // Speed (Fast Ball).
  isFusion?: boolean;
  baseSpeed?: number;
  // Infinite Fusion only: this is the last ball of its kind in the bag, which
  // makes a critical capture possible, and how many species the Pokédex has
  // registered as caught, which scales that chance.
  lastBall?: boolean;
  dexOwned?: number;
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
  const conditionOff = ballHasCondition(input.ball) && input.conditionMet === false;
  const mult = conditionOff ? 1 : ballMultiplierGen2(input.ball, input);
  // Gold/Silver/Crystal's Level Ball skips the HP factor and the status bonus
  // altogether (a cartridge bug, per Bulbapedia's Level Ball page): only the
  // level-scaled rate counts.
  if (input.ball === "level") {
    const levelValue = Math.min(255, Math.max(1, Math.floor(effectiveBaseRate(input) * mult)));
    return { guaranteed: false, chance: levelValue / 256, ballText: `×${mult}`, statusText: "+0" };
  }
  const bonus = input.status === "sleep" || input.status === "freeze" ? 10 : 0;
  const value = Math.min(
    255,
    Math.max(1, Math.floor(((3 - 2 * hpFrac) / 3) * effectiveBaseRate(input) * mult)) + bonus,
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
  const conditionOff = ballHasCondition(input.ball) && input.conditionMet === false;
  const ballBonus = conditionOff
    ? 1
    : ballMultiplierGen34(input.ball, {
        types: input.types,
        level: input.level,
        ownLevel: input.ownLevel,
        turn: input.turn,
      });
  const statusBonus = STATUS_MULTIPLIERS[input.status];
  const ballText = `×${ballBonus}`;
  const statusText = `×${statusBonus}`;

  if (input.ball === "master") {
    return { guaranteed: true, chance: 1, ballText: "×1", statusText };
  }

  const a = Math.max(1, ((3 - 2 * hpFrac) / 3) * effectiveBaseRate(input) * ballBonus * statusBonus);
  if (a >= 255) {
    return { guaranteed: true, chance: 1, ballText, statusText };
  }

  const b = Math.min(65535, Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a))));
  const chance = Math.pow(b / 65536, 4);
  return { guaranteed: false, chance, ballText, statusText };
}

// Gen 5 keeps Gen 3/4's modified catch rate but changes what happens after:
// the shake probability uses the exponent 3/16 instead of 1/4, and only THREE
// shake checks are made instead of four - which together make Gen 5 noticeably
// more generous at the same catch rate.
function computeGen5(input: CatchInput): CatchResult {
  const hpFrac = Math.min(100, Math.max(1, input.hpPercent)) / 100;
  const conditionOff = ballHasCondition(input.ball) && input.conditionMet === false;
  const ballBonus = conditionOff
    ? 1
    : ballMultiplierGen5(input.ball, {
        types: input.types,
        level: input.level,
        ownLevel: input.ownLevel,
        turn: input.turn,
      });
  const statusBonus = STATUS_MULTIPLIERS_GEN5[input.status];
  const ballText = `×${ballBonus}`;
  const statusText = `×${statusBonus}`;

  // The Dream Ball never fails in Gen 5 (its 4x nerf came later).
  if (input.ball === "master" || input.ball === "dream") {
    return { guaranteed: true, chance: 1, ballText: "×1", statusText };
  }

  const a = Math.max(1, ((3 - 2 * hpFrac) / 3) * effectiveBaseRate(input) * ballBonus * statusBonus);
  if (a >= 255) {
    return { guaranteed: true, chance: 1, ballText, statusText };
  }

  const b = Math.min(65535, Math.floor(65536 / Math.pow(255 / a, 3 / 16)));
  const chance = Math.pow(b / 65536, 3);
  return { guaranteed: false, chance, ballText, statusText };
}

// ---------------------------------------------------------------------------
// Pokémon Infinite Fusion runs on Pokémon Essentials v18 with its own capture
// code, read from github.com/infinitefusion/infinitefusion-e18:
// pbCaptureCalc (011_Battle/003_Battle/001_PokeBattle_BattleCommon.rb), the
// ball handlers (011_Battle/005_BallHandlers_PokeBallEffects.rb) and the
// game's own balls (052_AddOns/New Balls.rb, which also REPLACES the Dream
// Ball's handler - it loads later). It is none of the real generations:
//   - the modified rate is floored after the status bonus, then the shake
//     value uses Gen 5's exponent 3/16 but makes FOUR checks, not three;
//   - NEW_POKE_BALL_CATCH_RATES is off (MECHANICS_GENERATION = 5), so Net,
//     Repeat and Lure are ×3, Dusk ×3.5, and the Heavy Ball uses the old
//     weight brackets with no neutral step;
//   - the "last ball in the bag" critical capture is not modelled (it depends
//     on the bag contents and the dex count, not on the throw).
// ---------------------------------------------------------------------------

// Balls that give the target a status as they are thrown, before the status
// bonus is read - so e.g. a Frost Ball earns the ×2.5 freeze bonus.
const STATUS_BALLS_INFINITE_FUSION: Partial<Record<BallId, StatusId>> = {
  dream: "sleep",
  toxic: "poison",
  spark: "paralysis",
  scorch: "burn",
  frost: "freeze",
};

// Weights are compared in hectograms there; below 204.8 kg is always -20.
export function heavyBallModifierInfiniteFusion(weightKg: number | undefined): number {
  if (weightKg === undefined) return 0;
  const hectograms = weightKg * 10;
  if (hectograms >= 4096) return 40;
  if (hectograms >= 3072) return 30;
  if (hectograms >= 2048) return 20;
  return -20;
}

// Ruby's Float#floor(1), which several of the game's own balls use.
const floorToTenth = (n: number) => Math.floor(n * 10) / 10;
const multiplierText = (m: number) => `×${Number(m.toFixed(2))}`;

function modifiedRateInfiniteFusion(input: CatchInput): { rate: number; ballText: string } {
  const rate = input.baseRate;
  const conditionOff =
    ballHasCondition(input.ball, INFINITE_FUSION_VERSION_GROUP) && input.conditionMet === false;
  // `capped`: the handlers that clamp their own result to 255.
  const times = (m: number, capped = false) => ({
    rate: capped ? Math.min(255, rate * m) : rate * m,
    ballText: multiplierText(m),
  });
  switch (input.ball) {
    case "great":
    case "safari":
    case "sport":
      return times(1.5);
    case "ultra":
      return times(2);
    case "net":
      return times(input.types.includes("water") || input.types.includes("bug") ? 3 : 1);
    case "dive":
      return times(conditionOff ? 1 : 3.5);
    case "nest":
      return times(input.level <= 30 ? Math.max((41 - input.level) / 10, 1) : 1);
    case "repeat":
      return times(conditionOff ? 1 : 3);
    case "timer":
      // turnCount is 0 on the first turn.
      return times(Math.min(1 + 0.3 * (input.turn - 1), 4));
    case "dusk":
      return times(conditionOff ? 1 : 3.5);
    case "quick":
      return times(input.turn === 1 ? 5 : 1);
    case "fast":
      return times((input.baseSpeed ?? 0) >= 100 ? 4 : 1, true);
    case "level":
      // The game compares the highest level on your side of the field.
      return times(levelBallMultiplier(input.ownLevel, input.level), true);
    case "lure":
      return times(conditionOff ? 1 : 3, true);
    case "love":
      return times(conditionOff ? 1 : 8, true);
    case "moon":
      return times(conditionOff ? 1 : 4, true);
    case "heavy": {
      if (rate === 0) return { rate: 0, ballText: "+0" };
      const modifier = heavyBallModifierInfiniteFusion(input.weight);
      return {
        rate: Math.min(255, Math.max(1, rate + modifier)),
        ballText: modifier >= 0 ? `+${modifier}` : `${modifier}`,
      };
    }
    case "boost":
      return { rate: floorToTenth(rate * 0.8), ballText: "×0.8" };
    case "ability":
      return { rate: floorToTenth(rate * 0.6), ballText: "×0.6" };
    case "virus":
      return { rate: floorToTenth(rate * 0.4), ballText: "×0.4" };
    case "glitter":
      return { rate: floorToTenth(rate * 0.2), ballText: "×0.2" };
    case "perfect":
      return { rate: floorToTenth(rate * 0.1), ballText: "×0.1" };
    case "candy":
      return { rate: Math.floor(rate * 0.8), ballText: "×0.8" };
    // The game's Pure and Status Balls compare the battler's status against
    // the integer 0, but statuses are symbols (:NONE) there - so the Pure
    // Ball's "no status" bonus never applies and the Status Ball's "any
    // status" bonus always does. Modelled as the game behaves, not as the
    // ball descriptions intend.
    case "pure":
      return times(1);
    case "status":
      return { rate: Math.floor((rate * 5) / 2), ballText: "×2.5" };
    case "fusion":
      return times(input.isFusion ? 3 : 1);
    // poke, luxury, premier, heal, cherish, friend, gender, rocket, and the
    // status-inflicting balls: no rate change of their own.
    default:
      return times(1);
  }
}

function computeInfiniteFusion(input: CatchInput): CatchResult {
  const { rate, ballText } = modifiedRateInfiniteFusion(input);
  const status = STATUS_BALLS_INFINITE_FUSION[input.ball] ?? input.status;
  const statusBonus =
    status === "sleep" || status === "freeze" ? 2.5 : status === "none" ? 1 : 1.5;
  const statusText = `×${statusBonus}`;

  if (input.ball === "master") {
    return { guaranteed: true, chance: 1, ballText: "×1", statusText };
  }

  const hpFrac = Math.min(100, Math.max(1, input.hpPercent)) / 100;
  const x = Math.max(1, Math.floor(((3 - 2 * hpFrac) / 3) * rate * statusBonus));
  if (x >= 255) {
    return { guaranteed: true, chance: 1, ballText, statusText };
  }

  const y = Math.floor(65536 / Math.pow(255 / x, 0.1875));
  const allFourShakes = Math.pow(y / 65536, 4);
  if (!input.lastBall) {
    return { guaranteed: false, chance: allFourShakes, ballText, statusText };
  }

  // Critical capture - the game's own rule, not ENABLE_CRITICAL_CAPTURES
  // (which it leaves off): only when the thrown ball was the last of its kind
  // in the bag. A roll of pbRandom(256) < c, with c = x * n / 12 in integer
  // arithmetic and n = 2..5 by the dex's caught count, turns the throw into a
  // single shake check instead of four.
  const owned = input.dexOwned ?? 0;
  const n = owned > 600 ? 5 : owned > 450 ? 4 : owned > 300 ? 3 : 2;
  const c = Math.floor((x * n) / 12);
  const critical = Math.min(c, 256) / 256;
  return {
    guaranteed: false,
    chance: critical * (y / 65536) + (1 - critical) * allFourShakes,
    ballText,
    statusText,
  };
}

// `versionGroup` only matters for Infinite Fusion, whose capture code is its
// own rather than a generation's.
export function computeCatchChance(
  generation: number,
  input: CatchInput,
  versionGroup?: string,
): CatchResult {
  if (versionGroup === INFINITE_FUSION_VERSION_GROUP) return computeInfiniteFusion(input);
  if (generation === 1) return computeGen1(input);
  if (generation === 2) return computeGen2(input);
  if (generation >= 5) return computeGen5(input);
  return computeGen34(input);
}
