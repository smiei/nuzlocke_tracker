import { redirect } from "next/navigation";
import { getCatchRates, getGameOrDefault, getPokemonList, getRoutes } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { resolveRunId } from "@/lib/runs";
import { getLang } from "@/lib/i18n/getLang";
import { routeName } from "@/lib/i18n/localize";
import { Player, RunMode } from "@/generated/prisma/client";
import { CatchRateView, type OpenSlot } from "@/components/CatchRateView";
import { SpriteSetProvider } from "@/components/SpriteSetProvider";

export const dynamic = "force-dynamic";

export default async function CatchratePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const { run } = await searchParams;
  const { runId, mode, gameId, settings, canonical } = await resolveRunId(run);
  if (!canonical) redirect(`/catchrate?run=${runId}`);

  const lang = await getLang();
  const catchRates = Object.fromEntries(
    getCatchRates().map((entry) => [entry.id, entry.catch_rate]),
  );

  const encounters = await prisma.encounter.findMany({ where: { runId } });

  // Families already used by ANY encounter in this run (static or not) are
  // locked by the Species Clause - the calculator only warns, never blocks.
  // With the clause rule off, nothing is marked at all.
  const lockedFamilyIds = settings.speciesClause
    ? [...new Set(encounters.map((e) => e.familyId))]
    : [];
  const game = getGameOrDefault(gameId);

  // Open slots for the quick-catch dropdown: (route, player) pairs without an
  // encounter yet. Statics honor the run's "statics" rule (like the Tracker);
  // Classic only ever lists Player 1.
  const routes = getRoutes(gameId).filter((r) => settings.statics || r.type === "route");
  const players = mode === RunMode.CLASSIC ? [Player.PLAYER1] : [Player.PLAYER1, Player.PLAYER2];
  const openSlots: OpenSlot[] = [];
  for (const player of players) {
    for (const route of routes) {
      const taken = encounters.some((e) => e.routeId === route.id && e.player === player);
      if (!taken) openSlots.push({ routeId: route.id, player, routeName: routeName(route, lang) });
    }
  }

  return (
    <SpriteSetProvider spriteSet={game.spriteSet}>
      <CatchRateView
        runId={runId}
        mode={mode}
        pokemonList={getPokemonList(game.dexLimit)}
        catchRates={catchRates}
        lockedFamilyIds={lockedFamilyIds}
        generation={game.generation}
        openSlots={openSlots}
      />
    </SpriteSetProvider>
  );
}
