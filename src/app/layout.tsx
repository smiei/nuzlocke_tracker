import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Navigation } from "@/components/Navigation";
import { StickyNav } from "@/components/StickyNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BlindflugToggle } from "@/components/BlindflugToggle";
import { HeaderTitle } from "@/components/HeaderTitle";
import { RunSwitcher } from "@/components/RunSwitcher";
import { HeaderMenu } from "@/components/HeaderMenu";
import { DialogProvider } from "@/components/DialogProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { SessionWatch } from "@/components/SessionWatch";
import { TabOrderProvider } from "@/components/TabOrderProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { prisma } from "@/lib/prisma";
import { getGames } from "@/lib/data";
import { uiScaleBootScript } from "@/lib/uiScale";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nuzlocke SoulLink Tracker",
  description: "Pokémon SoulLink Random Nuzlocke Tracker",
  applicationName: "Nuzlocke SoulLink Tracker",
  // Home-screen label on iOS; it truncates around 12 characters, so the full
  // title would be cut mid-word.
  appleWebApp: { capable: true, title: "SoulLink" },
  // This app is wall-to-wall numbers (levels, catch rates, dex ids) and iOS
  // Safari auto-links digit runs as phone numbers - blue, underlined, and
  // they hijack the tap.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // A static default so the tag exists in the initial HTML; ThemeColorSync
  // rewrites it at runtime, because next-themes toggles a class that
  // prefers-color-scheme cannot see.
  themeColor: "#ffffff",
  // Deliberately NOT setting viewportFit: "cover" or disabling zoom. The tab
  // strip is sticky now (see StickyNav), but with the default fit iOS lays the
  // standalone viewport out BELOW the status bar, so `sticky top-0` pins under
  // it rather than behind it and there is still nothing to inset. Switching to
  // "cover" would create that work rather than solve it.
  // Pinch-zoom stays on - it matters on these dense tables.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runs = await prisma.run.findMany({ orderBy: { createdAt: "asc" } });
  const games = getGames().map((game) => ({ id: game.id, names: game.names }));

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Hand-written instead of the app/manifest.ts file convention, and
            this is load-bearing: Next only ever puts crossOrigin on its
            auto-injected manifest link when VERCEL_ENV === "preview" (see
            next/dist/lib/metadata/metadata.js), so on a self-hosted server it
            is always omitted. The browser then fetches the manifest WITHOUT
            cookies, Cloudflare Access answers with a login redirect, the fetch
            fails, and the install prompt silently never appears.
            React 19 hoists these <link>s into <head>. */}
        {/* Captures beforeinstallprompt during HTML parse. On a warm repeat
            visit Chrome fires it before React hydrates, so a listener added
            in a useEffect misses it and the install entry in the gear menu
            intermittently never shows up. useInstallPrompt reads this stash.
            React 19 does not hoist inline scripts, so it stays here and runs
            in place. */}
        {/* Applies the stored UI size before the first paint, the same job
            next-themes' own inline script does for the theme. Without it the
            page renders at 100% and then jumps to the chosen size on
            hydration. React 19 does not hoist inline scripts, so both of these
            run here, in place, ahead of the content. */}
        <script dangerouslySetInnerHTML={{ __html: uiScaleBootScript() }} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var s=function(e){window.__nuzlockeInstallPrompt=e;' +
              'window.dispatchEvent(new Event("nuzlocke:installprompt"))};' +
              'window.addEventListener("beforeinstallprompt",function(e){' +
              'e.preventDefault();s(e)});' +
              'window.addEventListener("appinstalled",function(){s(null)})})();',
          }}
        />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        {/* All icon links point into /icons/, which is what makes a private
            branding override possible: mounting a folder with an icon.svg onto
            /app/branding makes docker-entrypoint.sh regenerate every file here
            at container start, without any of it touching the repo or the
            public image. The master would have auto-injected its own,
            unoverridable <link> if it still lived at src/app/icon.svg. */}
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            <ToastProvider>
            <DialogProvider>
            <TabOrderProvider>
              {/* The title row is deliberately NOT sticky: the run switcher
                  and the gear are occasional, the tabs are constant. */}
              <header>
                {/* flex-wrap: on narrow screens the controls wrap to a second
                    line instead of widening the page (horizontal scroll). */}
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
                  <HeaderTitle />
                  <div className="flex flex-wrap items-center gap-2">
                    <Suspense
                      fallback={
                        <div className="h-9 w-32 rounded-md border border-line" />
                      }
                    >
                      <RunSwitcher runs={runs} games={games} />
                    </Suspense>
                    <Suspense fallback={<div className="h-9 w-9 rounded-md border border-line" />}>
                      <HeaderMenu runs={runs} />
                    </Suspense>
                    <ThemeToggle />
                    {/* Suspense because it reads ?run= via useSearchParams,
                        which would otherwise opt the statically prerendered
                        "/" out of static rendering - the same reason
                        RunSwitcher and Navigation are wrapped. */}
                    <Suspense fallback={<div className="h-10 w-10 rounded-md border border-line" />}>
                      <BlindflugToggle
                        runs={runs.map((run) => ({ id: run.id, settingsJson: run.settingsJson }))}
                      />
                    </Suspense>
                  </div>
                </div>
              </header>
              <StickyNav>
                {/* Exactly one tab's height (2px bottom border + 8px + 20px
                    icon + 4px gap + 16px label + 8px), so the strip does not
                    jump when Navigation replaces the fallback. In rem, not px,
                    so it follows the UI-size setting like the strip itself. */}
                <Suspense fallback={<div className="h-[3.625rem]" />}>
                  <Navigation />
                </Suspense>
              </StickyNav>
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
              <LiveRefresh />
              <ThemeColorSync />
              <ServiceWorkerRegistrar />
              <SessionWatch />
            </TabOrderProvider>
            </DialogProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
