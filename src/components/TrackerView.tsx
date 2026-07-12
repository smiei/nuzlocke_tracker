"use client";

import { useState } from "react";
import type { Route, Pokemon } from "@/lib/data";
import type { Encounter, RunMode } from "@/generated/prisma/client";
import { Player } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { routeName } from "@/lib/i18n/localize";
import { EncounterEditor } from "@/components/EncounterEditor";
import type { RunSettings } from "@/lib/runSettings";

export function TrackerView({
  runId,
  mode,
  lang,
  settings,
  routes,
  pokemonList,
  encounters,
}: {
  runId: number;
  mode: RunMode;
  lang: Lang;
  settings: RunSettings;
  routes: Route[];
  pokemonList: Pokemon[];
  encounters: Encounter[];
}) {
  const t = translations[lang].player;
  const tTracker = translations[lang].tracker;
  const isClassic = mode === "CLASSIC";
  // Post-game areas (Sevii 4-7, Cerulean Cave) are collapsed by default so
  // the main-game list stays tidy until the league is beaten.
  const [showPostgame, setShowPostgame] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);

  // A route counts as "done" once every player slot has an entry (any
  // status): both players in SoulLink, player 1 in Classic.
  function isRouteDone(route: Route): boolean {
    const p1 = encounters.some((e) => e.routeId === route.id && e.player === Player.PLAYER1);
    if (isClassic) return p1;
    const p2 = encounters.some((e) => e.routeId === route.id && e.player === Player.PLAYER2);
    return p1 && p2;
  }

  // "statics" rule off = static locations aren't tracked at all. The full
  // `routes` array still goes to the editors below - it's their lookup table
  // for route names in clause warnings, which may point at a static route.
  const trackable = settings.statics ? routes : routes.filter((r) => r.type === "route");
  const visible = openOnly ? trackable.filter((r) => !isRouteDone(r)) : trackable;
  const mainRoutes = visible.filter((r) => !r.postgame);
  const postgameRoutes = visible.filter((r) => r.postgame);

  function renderRoute(route: Route) {
    // SoulLink: exactly one of the two players has an entry -> the other
    // one still owes theirs; tint the row as a gentle reminder.
    const halfDone =
      !isClassic &&
      encounters.some((e) => e.routeId === route.id && e.player === Player.PLAYER1) !==
        encounters.some((e) => e.routeId === route.id && e.player === Player.PLAYER2);
    return (
      <div
        key={route.id}
        className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4 ${
          halfDone ? "border-l-2 border-l-amber-400 bg-amber-50/40 dark:bg-amber-950/10" : ""
        }`}
      >
        <div className="shrink-0 pt-1.5 sm:w-40">
          {halfDone && (
            <span
              className="mr-1 text-sm text-amber-500 dark:text-amber-400"
              title={tTracker.missingPlayer}
            >
              ⚠
            </span>
          )}
          <span className="font-medium">{routeName(route, lang)}</span>
          {route.type === "static" && (
            <span className="ml-1.5 inline-block rounded bg-sky-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              {tTracker.typeStatic}
            </span>
          )}
        </div>
        <div
          className={`grid flex-1 grid-cols-1 gap-3 sm:gap-4 ${
            isClassic ? "" : "sm:grid-cols-2"
          }`}
        >
          {isClassic ? (
            <EncounterEditor
              runId={runId}
              lang={lang}
              settings={settings}
              routeId={route.id}
              player={Player.PLAYER1}
              routes={routes}
              pokemonList={pokemonList}
              encounters={encounters}
            />
          ) : (
            <>
              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {t.PLAYER1}
                </span>
                <EncounterEditor
                  runId={runId}
                  lang={lang}
                  settings={settings}
                  routeId={route.id}
                  player={Player.PLAYER1}
                  routes={routes}
                  pokemonList={pokemonList}
                  encounters={encounters}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {t.PLAYER2}
                </span>
                <EncounterEditor
                  runId={runId}
                  lang={lang}
                  settings={settings}
                  routeId={route.id}
                  player={Player.PLAYER2}
                  routes={routes}
                  pokemonList={pokemonList}
                  encounters={encounters}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpenOnly((v) => !v)}
          title={tTracker.openOnlyTitle}
          className={`rounded-md border px-2 py-1.5 text-sm font-medium transition-colors ${
            openOnly
              ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {tTracker.openOnly}
        </button>
      </div>
      <div className="flex flex-col divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {mainRoutes.map(renderRoute)}
      {postgameRoutes.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPostgame((v) => !v)}
            className="flex w-full items-center justify-center gap-2 bg-zinc-50 p-3 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <span
              className={`inline-block transition-transform ${showPostgame ? "rotate-90" : ""}`}
            >
              ▸
            </span>
            {showPostgame
              ? tTracker.postgameHide
              : tTracker.postgameShow(postgameRoutes.length)}
          </button>
          {showPostgame && postgameRoutes.map(renderRoute)}
        </>
      )}
      </div>
    </div>
  );
}
