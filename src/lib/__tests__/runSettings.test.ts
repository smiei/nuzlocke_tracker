import { describe, it, expect } from "vitest";
import { parseRunSettings, DEFAULT_RUN_SETTINGS } from "@/lib/runSettings";

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
