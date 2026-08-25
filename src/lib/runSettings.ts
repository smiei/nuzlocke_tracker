// Per-run rule toggles, stored as a JSON object in Run.settingsJson (SQLite
// has no Json scalar in Prisma, so it's a TEXT column parsed here). All
// toggles are informational/UI-level rules - none of them make the server
// reject writes, matching how the Species Clause has always worked.
export type RunSettings = {
  // Show Species Clause warnings/lock markers (never blocks saving).
  speciesClause: boolean;
  // Shiny Clause: an encounter marked shiny is exempt from the Species Clause
  // (its own warning is suppressed and it doesn't lock the family for others).
  // Off = the shiny flag has no effect on the clause.
  shinyClause: boolean;
  // Show nickname inputs and render nicknames on cards. Data is kept when
  // toggled off, so flipping the rule is lossless.
  nicknames: boolean;
  // The game pack's evolution-overrides.json mirrors PokeRandoZX's two
  // separate randomizer options, so they toggle separately: entries tagged
  // category "impossible" ("Change Impossible Evolutions" - trade & co.
  // replaced) vs. "easier" ("Make Evolutions Easier" - lowered levels).
  evolutionOverridesImpossible: boolean;
  evolutionOverridesEasier: boolean;
  evolutionOverridesTimeBased: boolean;
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
  shinyClause: true,
  nicknames: true,
  evolutionOverridesImpossible: true,
  evolutionOverridesEasier: true,
  evolutionOverridesTimeBased: true,
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

// Max length of a RulePreset name, enforced by the action and the input.
export const PRESET_NAME_MAX = 40;


// Serialize just the boolean toggles, for storing in RulePreset.settingsJson.
// playerNames is deliberately left out: it is the one part of a run's settings
// that is about *that* run, so a preset carrying it would rename the players
// of every run it was applied to. Reading a preset back needs no counterpart -
// parseRunSettings already defaults every missing key, and the caller keeps
// the run's own playerNames.
export function serializePresetSettings(settings: RunSettings): string {
  const out: Record<string, boolean> = {};
  for (const key of RUN_SETTING_KEYS) out[key] = settings[key] as boolean;
  return JSON.stringify(out);
}
