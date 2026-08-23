import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Taken verbatim from Next's own PWA guide
        // (node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md).
        // The no-store part is not cosmetic here: /sw.js needs a Cloudflare
        // Access Bypass policy so the worker's own update check isn't answered
        // with a login redirect - and the moment Access stops marking it
        // `private`, .js is on Cloudflare's default cacheable-extension list,
        // so the edge could otherwise pin every device to a stale worker.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        // Next serves public/ with `Cache-Control: public, max-age=0`, i.e. a
        // 304 round-trip per sprite through the tunnel. This complements the
        // service worker for clients it does not control yet. Deliberately not
        // `immutable`: download-sprites.mjs may legitimately replace a file.
        source: "/pokemon-sprites/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
      {
        source: "/ball-sprites/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
