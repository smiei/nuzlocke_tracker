import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Navigation } from "@/components/Navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderTitle } from "@/components/HeaderTitle";
import { RunSwitcher } from "@/components/RunSwitcher";
import { HeaderMenu } from "@/components/HeaderMenu";
import { DialogProvider } from "@/components/DialogProvider";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { ThemeColorSync } from "@/components/ThemeColorSync";
import { SessionWatch } from "@/components/SessionWatch";
import { TabOrderProvider } from "@/components/TabOrderProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { prisma } from "@/lib/prisma";
import { getGames } from "@/lib/data";
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
  // Deliberately NOT setting viewportFit: "cover" or disabling zoom. With the
  // default fit iOS keeps the standalone viewport clear of the status bar and
  // home indicator, and nothing in this layout is fixed/sticky, so there is
  // nothing to inset. Pinch-zoom stays on - it matters on these dense tables.
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
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
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
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LanguageProvider>
            <DialogProvider>
            <TabOrderProvider>
              <header className="border-b border-zinc-200 dark:border-zinc-800">
                {/* flex-wrap: on narrow screens the controls wrap to a second
                    line instead of widening the page (horizontal scroll). */}
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
                  <HeaderTitle />
                  <div className="flex flex-wrap items-center gap-2">
                    <Suspense
                      fallback={
                        <div className="h-9 w-32 rounded-md border border-zinc-200 dark:border-zinc-700" />
                      }
                    >
                      <RunSwitcher runs={runs} games={games} />
                    </Suspense>
                    <Suspense fallback={<div className="h-9 w-9 rounded-md border border-zinc-200 dark:border-zinc-700" />}>
                      <HeaderMenu runs={runs} />
                    </Suspense>
                    <ThemeToggle />
                  </div>
                </div>
                <div className="mx-auto max-w-6xl">
                  <Suspense fallback={<div className="h-11" />}>
                    <Navigation />
                  </Suspense>
                </div>
              </header>
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
              <LiveRefresh />
              <ThemeColorSync />
              <ServiceWorkerRegistrar />
              <SessionWatch />
            </TabOrderProvider>
            </DialogProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
