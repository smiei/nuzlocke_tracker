"use client";

// Detects an expired Cloudflare Access session.
//
// Access is a login gate in front of the whole origin. When its session runs
// out, three things break silently and none of them surface an error the user
// can act on: the SSE stream reconnects into an HTML login page (a wrong
// content-type is fatal for EventSource - it does NOT retry again), Server
// Actions get their POST turned into a redirect so the useTransition pending
// flag never clears, and the page just sits there. In a normal browser tab you
// would hit reload; an installed PWA has no address bar, so the app has to
// notice by itself.
//
// `redirect: "manual"` is the whole trick: instead of following the 302 to the
// identity provider (and getting an opaque cross-origin result we cannot read),
// fetch resolves to a response with type "opaqueredirect" and status 0.

export async function isSessionExpired(): Promise<boolean> {
  try {
    const response = await fetch("/api/health", {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.type === "opaqueredirect") return true;
    // 401/403 covers an Access setup that answers directly instead of
    // redirecting. A genuine 5xx is a server problem, not an expired session,
    // so it deliberately does not count.
    return response.status === 401 || response.status === 403;
  } catch {
    // Offline or the server is down - not a session problem, and reloading
    // would only replace the app with a browser error page.
    return false;
  }
}
