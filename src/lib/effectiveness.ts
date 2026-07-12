import { TYPE_LABELS } from "@/lib/pokemonTypes";

// Classic Gen 3 type-chart order (no Fairy in Gen 3). Also correct for
// gens 2-5.
export const GEN3_TYPES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
];

// Gen 1 lacks Dark and Steel.
export const GEN1_TYPES = GEN3_TYPES.filter((t) => t !== "dark" && t !== "steel");

export function getTypesForGeneration(generation: number): string[] {
  return generation === 1 ? GEN1_TYPES : GEN3_TYPES;
}

// effectiveness.json is keyed by German type names from the defender's
// perspective: table[defenderType][attackType] = multiplier.
// Pairs missing from the JSON deal neutral (1.0) damage.
export type EffectivenessTable = Record<string, Record<string, number>>;

const toGerman = TYPE_LABELS.de;

export function singleTypeMultiplier(
  table: EffectivenessTable,
  attackType: string,
  defenseType: string,
): number {
  return table[toGerman[defenseType]]?.[toGerman[attackType]] ?? 1;
}

// Multiplier per attack type against a (single- or dual-typed) defender.
// Dual types multiply, so immunities (0) win over everything.
export function computeDefenseMultipliers(
  table: EffectivenessTable,
  defenderTypes: string[],
  attackTypes: string[] = GEN3_TYPES,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const attack of attackTypes) {
    result[attack] = defenderTypes.reduce(
      (product, defense) => product * singleTypeMultiplier(table, attack, defense),
      1,
    );
  }
  return result;
}
