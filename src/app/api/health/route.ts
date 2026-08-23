export const dynamic = "force-dynamic";

// Cheapest possible authenticated endpoint, used by SessionWatch to notice
// that the Cloudflare Access session has expired.
//
// The point is the *shape* of the answer, not the body: fetched with
// `redirect: "manual"`, a live session gives an opaque-free 204 while an
// expired one gives an opaqueredirect towards the Access login. In a browser
// tab you would just notice and reload; in an installed PWA there is no
// address bar, so this is how the app finds out.
export function GET() {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
