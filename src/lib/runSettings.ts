// Per-run rule toggles, stored as a JSON object in Run.settingsJson (SQLite
// has no Json scalar in Prisma, so it's a TEXT column parsed here). All
// toggles are informational/UI-level rules - none of them make the server
// reject writes, matching how the Species Clause has always worked.
export type RunSettings = {
  // Show Species Clause warnings/lock markers (never blocks saving).
  speciesClause: boolean;
  // Show nickname inputs and render nicknames on cards. Data is kept when
  // toggled off, so flipping the rule is lossless.
  nicknames: boolean;
  // The game pack's evolution-overrides.json mirrors PokeRandoZX's two
  // separate randomizer options, so they toggle separately: entries tagged
  // category "impossible" ("Change Impossible Evolutions" - trade & co.
  // replaced) vs. "easier" ("Make Evolutions Easier" - lowered levels).
  evolutionOverridesImpossible: boolean;
  evolutionOverridesEasier: boolean;
  // Show static locations (gifts, fossils, legendaries) on the Encounter tab.
  statics: boolean;
  // Statics don't count towards / trigger the Species Clause (today's fixed
  // behavior). Off = statics are treated like regular routes by the clause.
  staticsExemptFromClause: boolean;
  // Custom SoulLink player names (empty = fall back to the localized
  // "Player 1"/"Player 2"). Not a toggle - handled separately from the
  // boolean keys below.
  playerNames: { PLAYER1: string; PLAYER2: string };
};

// Defaults mirror the app's behavior before settings existed, so old runs
// (settingsJson '{}') keep working exactly as they did.
export const DEFAULT_RUN_SETTINGS: RunSettings = {
  speciesClause: true,
  nicknames: true,
  evolutionOverridesImpossible: true,
  evolutionOverridesEasier: true,
  statics: true,
  staticsExemptFromClause: true,
  playerNames: { PLAYER1: "", PLAYER2: "" },
};

// Only the boolean toggles - playerNames is handled separately.
export const RUN_SETTING_KEYS = (
  Object.keys(DEFAULT_RUN_SETTINGS) as (keyof RunSettings)[]
).filter((k) => typeof DEFAULT_RUN_SETTINGS[k] === "boolean") as (keyof RunSettings)[];

// Tolerant parser: unknown keys are dropped, missing/mistyped keys fall back
// to their default, malformed JSON falls back entirely.
export function parseRunSettings(json: string): RunSettings {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ...DEFAULT_RUN_SETTINGS };
  }
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_RUN_SETTINGS };

  const settings = { ...DEFAULT_RUN_SETTINGS };
  // Legacy: a single `evolutionOverrides` toggle existed before the split -
  // carry a stored value over to both new toggles (explicit new keys below
  // still win).
  const legacy = (raw as Record<string, unknown>).evolutionOverrides;
  if (typeof legacy === "boolean") {
    settings.evolutionOverridesImpossible = legacy;
    settings.evolutionOverridesEasier = legacy;
  }
  for (const key of RUN_SETTING_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") (settings[key] as boolean) = value;
  }
  const names = (raw as Record<string, unknown>).playerNames;
  if (typeof names === "object" && names !== null) {
    const p1 = (names as Record<string, unknown>).PLAYER1;
    const p2 = (names as Record<string, unknown>).PLAYER2;
    settings.playerNames = {
      PLAYER1: typeof p1 === "string" ? p1.slice(0, 20) : "",
      PLAYER2: typeof p2 === "string" ? p2.slice(0, 20) : "",
    };
  }
  return settings;
}
