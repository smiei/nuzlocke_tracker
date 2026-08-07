import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";

// Server actions return one of these instead of a pre-formatted string, so
// each caller (which already knows the current UI language) can render the
// message in the right language - avoids threading `lang` through every
// mutating action just to format one string server-side.
export type ActionError =
  | { key: "unknownPokemon"; id: number }
  | { key: "unknownRoute"; id: number }
  | { key: "classicNoSecondPlayer" }
  | { key: "encounterNotFound"; id: number }
  | { key: "soulLinkNotFound"; id: number }
  | { key: "runNotFound"; id: number }
  | { key: "deadCannotEvolve" }
  | { key: "deadCannotRevert" }
  | { key: "invalidEvolutionTarget" }
  | { key: "invalidFormTarget" }
  | { key: "evolutionFamilyMismatch" }
  | { key: "noPreEvolution" }
  | { key: "unknownLevelCap"; id: number }
  | { key: "nameRequired" }
  | { key: "backupInvalid" }
  | { key: "backupEmpty" }
  | { key: "invalidTeamSlot" }
  | { key: "unexpected" };

export function formatActionError(error: ActionError, lang: Lang): string {
  const t = translations[lang].actions;
  switch (error.key) {
    case "unknownPokemon":
      return t.unknownPokemon(error.id);
    case "unknownRoute":
      return t.unknownRoute(error.id);
    case "classicNoSecondPlayer":
      return t.classicNoSecondPlayer;
    case "encounterNotFound":
      return t.encounterNotFound(error.id);
    case "soulLinkNotFound":
      return t.soulLinkNotFound(error.id);
    case "runNotFound":
      return t.runNotFound(error.id);
    case "deadCannotEvolve":
      return t.deadCannotEvolve;
    case "deadCannotRevert":
      return t.deadCannotRevert;
    case "invalidEvolutionTarget":
      return t.invalidEvolutionTarget;
    case "invalidFormTarget":
      return t.invalidFormTarget;
    case "evolutionFamilyMismatch":
      return t.evolutionFamilyMismatch;
    case "noPreEvolution":
      return t.noPreEvolution;
    case "unknownLevelCap":
      return t.unknownLevelCap(error.id);
    case "nameRequired":
      return t.nameRequired;
    case "backupInvalid":
      return t.backupInvalid;
    case "backupEmpty":
      return t.backupEmpty;
    case "invalidTeamSlot":
      return t.invalidTeamSlot;
    case "unexpected":
      return t.unexpected;
  }
}
