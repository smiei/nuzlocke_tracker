import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Guards the PWA wiring, which is easy to "clean up" into something that looks
// tidier and is silently broken behind Cloudflare Access. Same spirit as
// moveNameHistory.test.ts: assert a curated file against reality.

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf-8");

describe("manifest wiring", () => {
  const layout = read("src/app/layout.tsx");

  it("links the manifest by hand, with credentials", () => {
    // Next only sets crossOrigin on its own manifest link when
    // VERCEL_ENV === "preview", so on this self-hosted deploy the auto-injected
    // one is always credential-less. Without cookies, Cloudflare Access answers
    // the manifest fetch with a login redirect, the fetch fails, and the
    // install prompt never appears.
    expect(layout).toContain('rel="manifest"');
    expect(layout).toContain('crossOrigin="use-credentials"');
  });

  it("does not also use the app/manifest file convention", () => {
    // That would inject a SECOND, credential-less <link rel="manifest">, and
    // the spec uses the first one - reintroducing the exact bug above.
    for (const ext of ["ts", "js", "json", "webmanifest"]) {
      expect(existsSync(path.join(root, "src/app", `manifest.${ext}`)), ext).toBe(false);
    }
  });

  it("still needs the workaround (i.e. Next has not fixed it)", () => {
    // If a Next upgrade drops the VERCEL_ENV condition, this fails and the
    // hand-written link can go back to being app/manifest.ts.
    const metadata = read("node_modules/next/dist/lib/metadata/metadata.js");
    expect(metadata).toContain("VERCEL_ENV === 'preview' ? 'use-credentials' : undefined");
  });
});

describe("public/manifest.webmanifest", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest")) as {
    id: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };

  it("sets an explicit id", () => {
    // Without one the id defaults to start_url, so changing start_url later
    // would mint a new app identity and orphan every installed copy.
    expect(manifest.id).toBeTruthy();
  });

  it("starts on a real page rather than the redirecting root", () => {
    // src/app/page.tsx is only a redirect("/tracker"); starting at "/" costs a
    // round-trip plus an Access check on every cold launch.
    expect(manifest.start_url).toBe("/tracker");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("ships both an 'any' and a 'maskable' icon at 192 and 512", () => {
    for (const purpose of ["any", "maskable"]) {
      for (const size of ["192x192", "512x512"]) {
        const hit = manifest.icons.find((i) => i.purpose === purpose && i.sizes === size);
        expect(hit, `${purpose} ${size}`).toBeDefined();
      }
    }
  });

  it("references only icons the generator actually produces", () => {
    const generator = read("scripts/generate-icons.mjs");
    for (const icon of manifest.icons) {
      expect(generator, icon.src).toContain(path.basename(icon.src));
    }
  });
});

describe("icon source", () => {
  it("keeps the tracked default outside app/, so Next injects no icon link", () => {
    // As src/app/icon.svg it would be a file-convention route with its own
    // auto-injected <link rel="icon"> that we could neither replace nor point
    // at the runtime-overridable copy in /icons/.
    expect(existsSync(path.join(root, "branding/icon.svg"))).toBe(true);
    expect(existsSync(path.join(root, "src/app/icon.svg"))).toBe(false);
  });

  it("links every icon from the overridable /icons/ path", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('href="/icons/icon.svg"');
    expect(layout).toContain('href="/icons/apple-touch-icon.png"');
  });
});

describe("service worker", () => {
  const sw = read("public/sw.js");

  it("never intercepts the SSE stream or Access endpoints", () => {
    // /api/events has destination "" - there is no "eventsource" destination -
    // so this has to be a path check. Intercepting it kills live sync.
    expect(sw).toContain('path.startsWith("/api/")');
    expect(sw).toContain('path.startsWith("/cdn-cgi/")');
    expect(sw).toContain('path === "/manifest.webmanifest"');
  });

  it("skips Next 16 router traffic", () => {
    expect(sw).toContain('request.headers.has("rsc")');
    expect(sw).toContain('request.headers.has("next-action")');
    expect(sw).toContain('url.searchParams.has("_rsc")');
    expect(sw).toContain('request.method !== "GET"');
  });

  it("keeps all five cache-poisoning guards", () => {
    // Drop any one of these and an expired Access session can put an opaque
    // response or a login page into the cache in place of a sprite, breaking
    // every image permanently - even after a successful re-login.
    expect(sw).toContain("response.status !== 200");
    expect(sw).toContain('response.type !== "basic"');
    expect(sw).toContain("response.redirected");
    expect(sw).toContain('type.startsWith("image/")');
    expect(sw).toContain("if (!response) return false");
  });

  it("does not cache the immutable build output", () => {
    expect(sw).not.toContain('"/_next/');
  });

  it("does not force-activate over open pages", () => {
    // skipWaiting() may only appear in the debug message handler, never in the
    // install listener.
    const install = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
    expect(install).not.toContain("skipWaiting");
  });
});
