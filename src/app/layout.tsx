import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Navigation } from "@/components/Navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RunSwitcher } from "@/components/RunSwitcher";
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
          <header className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <h1 className="text-base font-semibold sm:text-lg">
                <span className="sm:hidden">SoulLink Tracker</span>
                <span className="hidden sm:inline">SoulLink Nuzlocke Tracker</span>
              </h1>
              <div className="flex items-center gap-2">
                <Suspense
                  fallback={
                    <div className="h-9 w-32 rounded-md border border-zinc-200 dark:border-zinc-700" />
                  }
                >
                  <RunSwitcher runs={runs} />
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
        </ThemeProvider>
      </body>
    </html>
  );
}
