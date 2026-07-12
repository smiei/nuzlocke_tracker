import type { EncounterStatus, LinkStatus, Player, RunMode } from "@/generated/prisma/client";

export type RunSummary = {
  id: number;
  name: string;
  mode: RunMode;
};

export type SoulLinkView = {
  id: number;
  routeId: number;
  routeName: string;
  status: LinkStatus;
  teamPosition: number | null;
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
