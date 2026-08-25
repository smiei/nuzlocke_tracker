import { prisma } from "@/lib/prisma";
import { getRoutes, type Route } from "@/lib/data";
import { customRouteToRoute, isCustomRouteId, mergeRoutes } from "@/lib/customRoutes";

// The route list a run actually plays: the game pack's routes.json with the
// run's own hand-added locations spliced in.
//
// Every consumer must go through here rather than getRoutes(), otherwise a
// custom route is invisible to that view - and the Encounter tab's progress
// bar, which counts routes.length, would disagree with the list underneath it.
export async function getRoutesForRun(runId: number, gameId: string): Promise<Route[]> {
  const customRoutes = await prisma.customRoute.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
  });
  if (customRoutes.length === 0) return getRoutes(gameId);
  return mergeRoutes(getRoutes(gameId), customRoutes);
}

// Single route lookup that also resolves the run's custom ids - the server
// actions validate an incoming routeId with this, and a custom route must not
// come back as "unknown route".
export async function getRouteForRun(
  runId: number,
  gameId: string,
  routeId: number,
): Promise<Route | undefined> {
  if (!isCustomRouteId(routeId)) {
    return getRoutes(gameId).find((route) => route.id === routeId);
  }
  const row = await prisma.customRoute.findUnique({
    where: { runId_routeId: { runId, routeId } },
  });
  return row ? customRouteToRoute(row) : undefined;
}

// Next free custom id for a run: -1, then -2, and so on. Reusing a freed id
// would let a deleted route's leftover rows resurface under a new name, so
// this only ever counts downwards.
export async function nextCustomRouteId(runId: number): Promise<number> {
  const lowest = await prisma.customRoute.findFirst({
    where: { runId },
    orderBy: { routeId: "asc" },
    select: { routeId: true },
  });
  return Math.min(lowest?.routeId ?? 0, 0) - 1;
}
