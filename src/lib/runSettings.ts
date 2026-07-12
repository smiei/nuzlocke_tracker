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
  // Apply data/evolution-overrides.json (ROM/randomizer evolution changes,
  // e.g. "change impossible evolutions"). Off = vanilla methods.
  evolutionOverrides: boolean;
  // Show static locations (gifts, fossils, legendaries) on the Encounter tab.
  statics: boolean;
  // Statics don't count towards / trigger the Species Clause (today's fixed
  // behavior). Off = statics are treated like regular routes by the clause.
  staticsExemptFromClause: boolean;
};

// Defaults mirror the app's behavior before settings existed, so old runs
// (settingsJson '{}') keep working exactly as they did.
export const DEFAULT_RUN_SETTINGS: RunSettings = {
  speciesClause: true,
  nicknames: true,
  evolutionOverrides: true,
  statics: true,
  staticsExemptFromClause: true,
};

export const RUN_SETTING_KEYS = Object.keys(DEFAULT_RUN_SETTINGS) as (keyof RunSettings)[];

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
  for (const key of RUN_SETTING_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "boolean") settings[key] = value;
  }
  return settings;
}
