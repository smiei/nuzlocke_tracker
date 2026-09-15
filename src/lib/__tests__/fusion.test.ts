import { describe, it, expect } from "vitest";
import { computeFusionStats, computeFusionTypes, fusionCatchBaseRate } from "@/lib/fusion";
import type { Pokemon } from "@/lib/data";

const mon = (id: number, types: string[], stats: Pokemon["stats"]): Pokemon => ({
  id,
  names: { de: `#${id}`, en: `#${id}` },
  types,
  family_id: id,
  stats,
  legendary: false,
});

describe("computeFusionStats", () => {
  it("blends head-dominant (HP/SpA/SpD) and body-dominant (Atk/Def/Spe) stats", () => {
    // Bulbasaur (head) x Charmander (body); floor((2*dominant + other) / 3)
    // per stat, hand-verified: KP 43, Ang. 51, Vert. 45, Sp.-A. 63, Sp.-V. 60,
    // Init. 58, Summe 320.
    const bulbasaur = mon(1, ["grass", "poison"], {
      KP: 45, "Ang.": 49, "Vert.": 49, "Sp.-A.": 65, "Sp.-V.": 65, "Init.": 45, Summe: 318,
    });
    const charmander = mon(4, ["fire"], {
      KP: 39, "Ang.": 52, "Vert.": 43, "Sp.-A.": 60, "Sp.-V.": 50, "Init.": 65, Summe: 309,
    });
    expect(computeFusionStats(bulbasaur, charmander)).toEqual({
      KP: 43, "Ang.": 51, "Vert.": 45, "Sp.-A.": 63, "Sp.-V.": 60, "Init.": 58, Summe: 320,
    });
  });

  it("is asymmetric: swapping head and body changes the result", () => {
    const bulbasaur = mon(1, ["grass", "poison"], {
      KP: 45, "Ang.": 49, "Vert.": 49, "Sp.-A.": 65, "Sp.-V.": 65, "Init.": 45, Summe: 318,
    });
    const charmander = mon(4, ["fire"], {
      KP: 39, "Ang.": 52, "Vert.": 43, "Sp.-A.": 60, "Sp.-V.": 50, "Init.": 65, Summe: 309,
    });
    expect(computeFusionStats(charmander, bulbasaur)).not.toEqual(
      computeFusionStats(bulbasaur, charmander),
    );
  });

  it("Summe always equals the sum of the six blended stats, not a blend of the two Summes", () => {
    const a = mon(1, ["grass"], {
      KP: 10, "Ang.": 10, "Vert.": 10, "Sp.-A.": 10, "Sp.-V.": 10, "Init.": 100, Summe: 150,
    });
    const b = mon(2, ["fire"], {
      KP: 10, "Ang.": 10, "Vert.": 10, "Sp.-A.": 10, "Sp.-V.": 10, "Init.": 10, Summe: 60,
    });
    const out = computeFusionStats(a, b);
    expect(out.Summe).toBe(
      out.KP + out["Ang."] + out["Vert."] + out["Sp.-A."] + out["Sp.-V."] + out["Init."],
    );
  });
});

// Ported straight from the reference tracker's src/lib/__tests__/fusion-typing.test.ts
// (github.com/fbosch/infinite-fusion-nuzlocke, MIT) - same expected outputs,
// only the fixture shape changed to this app's Pokemon type.
describe("computeFusionTypes", () => {
  const bulbasaur = mon(1, ["grass", "poison"], {} as Pokemon["stats"]);
  const pikachu = mon(25, ["electric"], {} as Pokemon["stats"]);

  it("uses head primary and body secondary by default", () => {
    const nidoranM = mon(32, ["poison", "ground"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(bulbasaur, nidoranM)).toEqual(["grass", "ground"]);
  });

  it("uses body primary if it has no secondary", () => {
    expect(computeFusionTypes(bulbasaur, pikachu)).toEqual(["grass", "electric"]);
  });

  it("avoids redundancy: Grimer/Oddish -> Poison/Grass", () => {
    const grimer = mon(88, ["poison"], {} as Pokemon["stats"]);
    const oddish = mon(43, ["grass", "poison"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(grimer, oddish)).toEqual(["poison", "grass"]);
  });

  it("applies the swapped type order for Magnezone (Steel/Electric)", () => {
    const magnezone = mon(462, ["electric", "steel"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(magnezone, pikachu)).toEqual(["steel", "electric"]);
  });

  it("applies the swapped type order for Spiritomb (Dark/Ghost)", () => {
    const spiritomb = mon(442, ["ghost", "dark"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(spiritomb, pikachu)).toEqual(["dark", "electric"]);
  });

  it("applies the swapped type order for the Ferroseed line (Steel/Grass)", () => {
    const ferroseed = mon(597, ["grass", "steel"], {} as Pokemon["stats"]);
    const ferrothorn = mon(598, ["grass", "steel"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(ferroseed, pikachu)).toEqual(["steel", "electric"]);
    expect(computeFusionTypes(ferrothorn, pikachu)).toEqual(["steel", "electric"]);
  });

  it("applies the swapped type order for the Phantump line (Grass/Ghost)", () => {
    const phantump = mon(708, ["ghost", "grass"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(phantump, pikachu)).toEqual(["grass", "electric"]);
  });

  it("applies the swapped type order for the Sandygast line (Ground/Ghost)", () => {
    const sandygast = mon(769, ["ghost", "ground"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(sandygast, pikachu)).toEqual(["ground", "electric"]);
  });

  it("Normal/Flying dominant rule: body always passes Flying", () => {
    const pidgeot = mon(18, ["normal", "flying"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(bulbasaur, pidgeot)).toEqual(["grass", "flying"]);
  });

  it("Normal/Flying dominant rule: head passes Flying as primary", () => {
    const pidgeot = mon(18, ["normal", "flying"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(pidgeot, pikachu)).toEqual(["flying", "electric"]);
  });

  it("same Normal/Flying pair on both sides: head Flying, body falls back to Normal", () => {
    const pidgeot1 = mon(18, ["normal", "flying"], {} as Pokemon["stats"]);
    const pidgeot2 = mon(18, ["normal", "flying"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(pidgeot1, pidgeot2)).toEqual(["flying", "normal"]);
  });

  it("a single-typed body matching the head's type stays a duplicate pair (matches the reference implementation)", () => {
    // Not a fix target: this mirrors the upstream tracker's own fallback
    // behaviour rather than a bug introduced here (see the comment in
    // fusion.ts).
    const koffing = mon(109, ["poison"], {} as Pokemon["stats"]);
    expect(computeFusionTypes(koffing, koffing)).toEqual(["poison", "poison"]);
  });
});

describe("fusionCatchBaseRate", () => {
  it("takes the lower of the two base rates", () => {
    expect(fusionCatchBaseRate(45, 3)).toBe(3);
    expect(fusionCatchBaseRate(3, 45)).toBe(3);
  });

  it("is unchanged when both components share a rate", () => {
    expect(fusionCatchBaseRate(255, 255)).toBe(255);
  });
});
