import type { Metadata } from "next";
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
import { TabOrderProvider } from "@/components/TabOrderProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { prisma } from "@/lib/prisma";
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const runs = await prisma.run.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
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
                      <RunSwitcher runs={runs} />
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
            </TabOrderProvider>
            </DialogProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
