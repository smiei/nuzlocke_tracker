import { describe, it, expect } from "vitest";
import { RUN_SETTING_KEYS, serializePresetSettings, parseRunSettings, DEFAULT_RUN_SETTINGS } from "@/lib/runSettings";

describe("parseRunSettings", () => {
  it("returns all defaults for '{}' and for malformed JSON", () => {
    expect(parseRunSettings("{}")).toEqual(DEFAULT_RUN_SETTINGS);
    expect(parseRunSettings("not json")).toEqual(DEFAULT_RUN_SETTINGS);
    expect(parseRunSettings("null")).toEqual(DEFAULT_RUN_SETTINGS);
  });

  it("applies known boolean keys and ignores unknown ones", () => {
    const s = parseRunSettings('{"speciesClause": false, "somethingElse": true}');
    expect(s.speciesClause).toBe(false);
    expect(s.nicknames).toBe(true); // untouched default
    expect("somethingElse" in s).toBe(false);
  });

  it("carries the legacy evolutionOverrides toggle over to both new keys", () => {
    const s = parseRunSettings('{"evolutionOverrides": false}');
    expect(s.evolutionOverridesImpossible).toBe(false);
    expect(s.evolutionOverridesEasier).toBe(false);
  });

  it("reads and length-caps player names", () => {
    const s = parseRunSettings(
      '{"playerNames":{"PLAYER1":"Ash","PLAYER2":"01234567890123456789EXTRA"}}',
    );
    expect(s.playerNames.PLAYER1).toBe("Ash");
    expect(s.playerNames.PLAYER2).toHaveLength(20);
  });

  it("falls back to empty player names when malformed", () => {
    const s = parseRunSettings('{"playerNames":{"PLAYER1": 42}}');
    expect(s.playerNames).toEqual({ PLAYER1: "", PLAYER2: "" });
  });
});

describe("serializePresetSettings", () => {
  it("keeps every rule toggle", () => {
    const settings = parseRunSettings('{"speciesClause": false, "statics": false}');
    const json = JSON.parse(serializePresetSettings(settings)) as Record<string, boolean>;
    for (const key of RUN_SETTING_KEYS) {
      if (key === "debugMode") continue;
      expect(typeof json[key]).toBe("boolean");
    }
    expect(json.speciesClause).toBe(false);
    expect(json.statics).toBe(false);
    expect(json.nicknames).toBe(true);
  });

  it("never carries debugMode into a preset", () => {
    // It is a maintenance switch, not a rule: loading someone's ruleset must
    // not silently turn the order export on, or off mid-investigation.
    const settings = parseRunSettings('{"debugMode": true}');
    expect(settings.debugMode).toBe(true);
    expect(serializePresetSettings(settings)).not.toContain("debugMode");
    expect(parseRunSettings(serializePresetSettings(settings)).debugMode).toBe(false);
  });

  it("never carries player names into a preset", () => {
    // The one part of a run's settings that is about *that* run: a preset
    // holding it would rename the players of every run it is applied to.
    const settings = parseRunSettings('{"playerNames":{"PLAYER1":"Ash","PLAYER2":"Gary"}}');
    const json = serializePresetSettings(settings);
    expect(json).not.toContain("playerNames");
    expect(json).not.toContain("Ash");
  });

  it("round-trips back through parseRunSettings with default names", () => {
    const settings = parseRunSettings(
      '{"shinyClause": false, "playerNames":{"PLAYER1":"Ash","PLAYER2":"Gary"}}',
    );
    const back = parseRunSettings(serializePresetSettings(settings));
    expect(back.shinyClause).toBe(false);
    expect(back.playerNames).toEqual({ PLAYER1: "", PLAYER2: "" });
  });
});
