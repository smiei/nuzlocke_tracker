// Service worker for the Nuzlocke tracker PWA.
//
// Deliberately narrow. This app is entirely DB-backed, every content page is
// force-dynamic, and two devices sync live over SSE - so caching page data
// would show one player a state the other already changed, and offline writes
// have no merge logic whatsoever. The only thing cached here is immutable
// static artwork, which is also where the actual win is: Next serves public/
// with `Cache-Control: public, max-age=0`, so today every one of the ~2500
// Pokemon sprites costs a 304 round-trip through the Cloudflare tunnel.
//
// /_next/static is deliberately NOT cached. It already ships
// `max-age=31536000, immutable`, so the HTTP cache serves it from disk anyway,
// and caching it here would buy nothing while importing the whole
// cache-versioning hazard class - a new worker deleting the chunks a live page
// is still lazily loading gives you ChunkLoadError.
//
// Bump CACHE when isCacheableAsset() changes, or when a path moves between the
// two strategy lists, so entries written under the old rules are discarded.
// Not per deploy: the paths held here are otherwise stable.
// v2: /icons/ moved from cache-first to stale-while-revalidate.

const CACHE = "nuzlocke-assets-v2";

// Cache-first - addressed by dex/ball id, the bytes behind a path never change.
const IMMUTABLE = ["/pokemon-sprites/", "/ball-sprites/"];
// Stale-while-revalidate - these CAN change under a stable path: badges are
// re-cropped on every container start, /app/public/trainers is a writable bind
// mount, and /icons/ is regenerated at startup whenever a private branding
// override is mounted. Caching those cache-first would pin the old artwork in
// the browser forever, with no way to invalidate it.
const REVALIDATE = ["/badges/", "/trainers/", "/icons/"];

// The one function this whole file hinges on.
//
// An <img src="/pokemon-sprites/..."> is a no-cors request. With an expired
// Cloudflare Access session it follows a cross-origin login redirect and comes
// back OPAQUE: status 0, empty body - and the Cache API stores opaque
// responses for no-cors requests perfectly happily. That is how you end up
// with every sprite permanently blank even after a successful re-login.
//
// Access can also answer same-origin with a 200 HTML interstitial, which slips
// past both the status and the type check - only `redirected` and the
// content-type sniff catch that one. All five checks are load-bearing.
function isCacheableAsset(response) {
  if (!response) return false;
  if (response.status !== 200) return false; // opaque (0), 3xx, 4xx, 5xx, 206
  if (response.type !== "basic") return false; // opaque, opaqueredirect, cors, error
  if (response.redirected) return false; // the /cdn-cgi/access interstitial
  const type = (response.headers.get("content-type") || "").toLowerCase();
  return type.startsWith("image/"); // a 200 login page is text/html
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  // Always hand the response to the page; only store it if it really is an
  // image. A 404 is therefore never cached either, which is what keeps
  // TrainerSprite's onError fallback chain working and lets a PNG dropped into
  // the mounted trainers volume later be picked up with no invalidation.
  if (isCacheableAsset(response)) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const request = event.request;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const fromNetwork = fetch(request)
    .then(async (response) => {
      if (isCacheableAsset(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(fromNetwork);
    return hit;
  }
  const fresh = await fromNetwork;
  if (fresh) return fresh;
  return new Response(null, { status: 504, statusText: "Offline" });
}

async function networkOnly(request) {
  try {
    // Passing the ORIGINAL request object is essential. A navigation carries
    // redirect: "manual", so Cloudflare Access's 302 arrives as an
    // opaqueredirect which we hand back and the browser follows to the login
    // form. fetch(request.url) would build a fresh request with
    // redirect: "follow", and returning a `redirected` response for a
    // navigation is rejected outright by the browser - the user would get a
    // hard failure instead of being able to log in.
    return await fetch(request);
  } catch {
    return offlineResponse();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Positive list: only call respondWith for paths with an explicit strategy.
  // Everything else falls through to the network untouched - not even a
  // pass-through fetch, which would add latency and can buffer streams.
  if (request.method !== "GET") return; // Server Actions are POSTs

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  // /api/events is the SSE stream. It has destination "" - there is no
  // "eventsource" destination value - so this must be a path check, not a
  // destination check. Intercepting it breaks live sync through buffering and
  // stops the route's abort listener from ever firing.
  if (path.startsWith("/api/")) return;
  if (path.startsWith("/cdn-cgi/")) return; // Cloudflare Access and its logout
  // Leave the manifest to the browser's own fetch machinery: its redirect mode
  // is not "follow", and an SW-mediated redirect makes it fail outright.
  if (path === "/manifest.webmanifest") return;
  if (path === "/sw.js") return;
  // Next 16 router traffic (constants from
  // next/dist/client/components/app-router-headers.js): RSC payloads carry the
  // `rsc` header, Link prefetches append ?_rsc=, Server Actions send
  // `next-action`. All of them are live run data.
  if (request.headers.has("rsc")) return;
  if (request.headers.has("next-action")) return;
  if (url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkOnly(request));
    return;
  }
  if (IMMUTABLE.some((prefix) => path.startsWith(prefix))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (REVALIDATE.some((prefix) => path.startsWith(prefix))) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

self.addEventListener("install", () => {
  // Nothing is precached, on purpose. cache.addAll rejects the whole batch on
  // any non-2xx, and behind Cloudflare Access an expired session turns every
  // request into a redirect - install would reject, the worker would never
  // activate, and there would be no diagnostic at all. The offline page is
  // synthesised below instead, so it cannot fail to exist.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("nuzlocke-") && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      // Control already-open pages so the very first load after install starts
      // caching. Note there is deliberately no skipWaiting() on install: a new
      // worker waits for the old one to be released, because it holds only
      // path-stable assets and forcing a swap while two devices are mid-edit
      // gains nothing.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // Debugging escape hatch; deliberately not wired to any UI.
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

const OFFLINE_HTML = [
  '<!doctype html><html lang="de"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>Offline</title><style>",
  ":root{color-scheme:light dark}",
  "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;",
  'font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;',
  "background:#fff;color:#18181b;padding:1.5rem}",
  "main{max-width:28rem;text-align:center}",
  "h1{font-size:1.25rem;margin:0 0 .5rem}",
  "p{margin:0 0 1.5rem;line-height:1.5;color:#52525b}",
  ".en{font-size:.875rem;color:#71717a}",
  "button{font:inherit;font-weight:500;padding:.6rem 1.25rem;border-radius:.5rem;",
  "border:1px solid #d4d4d8;background:#fafafa;color:inherit;cursor:pointer}",
  "@media(prefers-color-scheme:dark){body{background:#09090b;color:#fafafa}",
  "p{color:#a1a1aa}button{background:#18181b;border-color:#3f3f46}}",
  "</style></head><body><main>",
  "<h1>Keine Verbindung</h1>",
  "<p>Der Tracker braucht den Server, weil zwei Ger&auml;te denselben Run teilen. ",
  "Sobald du wieder online bist, l&auml;dt die Seite normal.<br>",
  "<span class=\"en\">No connection &mdash; run data is always live, ",
  "so there is nothing to show offline.</span></p>",
  '<button onclick="location.reload()">Erneut versuchen</button>',
  "</main></body></html>",
].join("");

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
