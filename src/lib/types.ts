import type { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";
import type { LocalizedNames } from "@/lib/i18n/localize";

export type RunSummary = {
  id: number;
  name: string;
  mode: RunMode;
  gameId: string;
};

// Client-safe slice of data.ts's GameInfo (components can't import data.ts -
// it reads from node:fs). games[0] is the default pack (lowest sort).
export type GameSummary = {
  id: string;
  names: LocalizedNames;
};

export type SoulLinkView = {
  id: number;
  routeId: number;
  routeName: string;
  status: LinkStatus;
  teamPosition: number | null;
  deathPlayer: Player | null;
  encounters: {
    id: number;
    player: Player;
    pokemonId: number;
    pokemonName: string;
    // Already gated by the run's `nicknames` rule server-side: null when the
    // rule is off, so display components never need to know about settings.
    nickname: string | null;
    types: string[];
    summe: number;
    rang: number;
    status: EncounterStatus;
    isStatic: boolean;
    evolvesTo: { id: number; name: string; method: string | null; available: boolean }[];
    evolvesFrom: { id: number; name: string } | null;
  }[];
};

export type EncounterView = SoulLinkView["encounters"][number];
