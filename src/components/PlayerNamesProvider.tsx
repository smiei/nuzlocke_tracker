"use client";

import { createContext, useContext } from "react";
import type { Player } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import type { PlayerNames } from "@/lib/runSettings";
import { ALL_PLAYERS } from "@/lib/players";

// Resolves a player to their custom SoulLink name (from run settings) or the
// localized "Player 1"/"Player 2"/... default. Set once per run-scoped page so
// every label ("Spieler 1", team headings, mark-dead, quick-catch) follows
// the run's chosen names.
const Ctx = createContext<((player: Player) => string) | null>(null);

export function PlayerNamesProvider({
  names,
  lang,
  children,
}: {
  names: PlayerNames;
  lang: Lang;
  children: React.ReactNode;
}) {
  const t = translations[lang].player;
  const label = (player: Player) => names[player]?.trim() || t[player];
  return <Ctx.Provider value={label}>{children}</Ctx.Provider>;
}

export function usePlayerLabel(): (player: Player) => string {
  const label = useContext(Ctx);
  // Graceful fallback if a page forgot to provide (English default).
  return label ?? ((player) => `Player ${ALL_PLAYERS.indexOf(player) + 1}`);
}
