import { NextResponse, type NextRequest } from "next/server";
import { resolveRunId } from "@/lib/runs";

// The Catchrate tab was folded into the combined "Kampf & Fang" tab (/typen):
// enter a Pokémon once, then switch between the Wild (catch) and Trainer
// (battle) views. This route stays behind so old bookmarks still land on the
// current run's combined tab.
//
// A Route Handler rather than a page, because a page's redirect() is thrown
// inside app/loading.tsx's Suspense boundary: the loading shell has already
// been flushed by then, so Next can only answer with a
// <meta http-equiv="refresh" content="1;...">. Here it stays a real 307.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const run = request.nextUrl.searchParams.get("run") ?? undefined;
  const { runId } = await resolveRunId(run);
  return NextResponse.redirect(new URL(`/typen?run=${runId}`, request.nextUrl));
}
