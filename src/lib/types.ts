import type { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { LocalizedNames } from "@/lib/i18n/localize";

export type RunSummary = {
  id: number;
  // What ?run= carries and every action takes - see src/lib/runKey.ts.
  accessKey: string;
  name: string;
  mode: RunMode;
  // SoulLink players (2-4); meaningless for Classic.
  playerCount: number;
  gameId: string;
};

// Client-safe slice of data.ts's GameInfo (components can't import data.ts -
// it reads from node:fs). games[0] is the default pack (lowest sort).
export type GameSummary = {
  id: string;
  names: LocalizedNames;
  // The pack has fusions (Infinite Fusion) - the gear menu credits its
  // outside sources while such a run is open.
  fusion?: boolean;
};

// Shared by a fusion's host row and its body sub-object - the evolution
// surface a single encounter offers, independent of whether it's the head or
// the body of a fusion.
export type EvolutionOptions = {
  formOptions: { id: number; label: string; summe: number }[];
  evolvesTo: { id: number; name: string; method: string | null; available: boolean }[];
  evolvesFrom: { id: number; name: string } | null;
};

// One Team-tab card. Everywhere but Infinite Fusion that is exactly one
// SoulLink (one route). With fusions it is one fusion GROUP - every link a
// fusion connects, see src/lib/fusionGroups.ts - and every id/position below
// describes the group.
export type SoulLinkView = {
  // The group's first link in route order - what markDead/markAlive/
  // setTeamSlot are called with; they act on the whole group server-side.
  id: number;
  // Every link in the card, in route order. [id] without fusions.
  linkIds: number[];
  routeId: number;
  // All of the group's route names joined with " + ".
  routeName: string;
  status: LinkStatus;
  // The lowest team slot the group holds - where its card sits.
  teamPosition: number | null;
  // Every slot the group holds, ascending; more than one while a player has
  // more separate Pokémon in the group than the other (teamSlotsNeeded).
  teamPositions: number[];
  deathPlayer: Player | null;
  deathCause: string | null;
  // The group's battle units: every encounter except donors, which appear as
  // the `body` of their host's entry instead.
  encounters: ({
    id: number;
    player: Player;
    // The route this encounter was caught on - shown on the tile once a card
    // spans several routes.
    routeName: string;
    pokemonId: number;
    // The head's own species name - EncounterMon's fused name when a body is
    // present ("Bulbasaur / Charmander"), otherwise identical to before.
    pokemonName: string;
    // Already gated by the run's `nicknames` rule server-side: null when the
    // rule is off, so display components never need to know about settings.
    nickname: string | null;
    // Fused types/stats when a body is present (see src/lib/encounterMon.ts),
    // otherwise identical to before.
    types: string[];
    summe: number;
    // Highest BST reachable by fully evolving (within the game's dex) -
    // fuses each side's OWN best evolution when a body is present.
    summeMax: number;
    // No rank for a fusion (see CLAUDE.md) - 0 when body is non-null.
    rang: number;
    status: EncounterStatus;
    isStatic: boolean;
    shiny: boolean;
    // Infinite Fusion only: this encounter is a fusion HOST when set. The
    // donor keeps its own full evolution surface (it can evolve/revert/change
    // forme independently of the head) - see CLAUDE.md's Infinite Fusion
    // section. null on every other pack, and on an unfused encounter.
    body:
      | (EvolutionOptions & {
          encounterId: number;
          pokemonId: number;
          pokemonName: string;
          // The donor's own route - the fusion is made of two catches.
          routeName: string;
        })
      | null;
  } & EvolutionOptions)[];
};

export type EncounterView = SoulLinkView["encounters"][number];

// Infinite Fusion only: one of a player's own catches that could be fused
// (CAUGHT, link alive, not already part of another fusion in either role).
// Passed once per run to the Team tab's fuse dialog rather than recomputed
// per card, mirroring how pokemonList/teamLinks are already flat lists.
export type FusableEncounter = {
  id: number;
  player: Player;
  pokemonId: number;
  routeName: string;
  pokemonName: string;
};
