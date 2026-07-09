import type { EncounterStatus, LinkStatus, Player } from "@/generated/prisma/client";

export type SoulLinkView = {
  id: number;
  routeId: number;
  routeName: string;
  status: LinkStatus;
  encounters: {
    id: number;
    player: Player;
    pokemonId: number;
    pokemonName: string;
    types: string[];
    summe: number;
    rang: number;
    status: EncounterStatus;
    isStatic: boolean;
    evolvesTo: { id: number; name: string }[];
    evolvesFrom: { id: number; name: string } | null;
  }[];
};
