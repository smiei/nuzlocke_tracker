import { NextResponse, type NextRequest } from "next/server";

// The Team-Weaknesses tab was absorbed into the Overview tab (defensive +
// offensive coverage live there now). Kept as a redirect so old links and
// bookmarks still work - as a Route Handler, for the same reason as
// /catchrate: a page redirect below app/loading.tsx degrades into a
// one-second <meta http-equiv="refresh"> instead of a 307.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const run = request.nextUrl.searchParams.get("run");
  return NextResponse.redirect(
    new URL(run ? `/overview?run=${run}` : "/overview", request.nextUrl),
  );
}
