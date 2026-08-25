"use client";

import { useState } from "react";
import type { Route, Pokemon } from "@/lib/data";
import type { Encounter, RunMode } from "@/generated/prisma/client";
import { Player } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { routeName } from "@/lib/i18n/localize";
import { isRouteDone, computeRouteProgress } from "@/lib/progress";
import { EncounterEditor } from "@/components/EncounterEditor";
import { ProgressBar } from "@/components/ProgressBar";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import type { RunSettings } from "@/lib/runSettings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, PageHeader } from "@/components/ui/Page";

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
  const playerLabel = usePlayerLabel();
  const tTracker = translations[lang].tracker;
  const isClassic = mode === "CLASSIC";
  // Post-game areas (Sevii 4-7, Cerulean Cave) are collapsed by default so
  // the main-game list stays tidy until the league is beaten.
  const [showPostgame, setShowPostgame] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  // The route the user last edited. "Open only" keeps it on screen even once it
  // is complete, so filling in a species no longer makes the row vanish before
  // the nickname, shiny flag or status can be set. Exactly one extra row, and
  // it moves along as you work down the list.
  //
  // This replaces the "Bestätigen" button that used to solve the same problem
  // by deferring the save - which in turn needed a whole draft-broadcast
  // mechanism so the other player still saw the in-progress pick. Both are gone.
  const [lastTouchedRouteId, setLastTouchedRouteId] = useState<number | null>(null);

  // "statics" rule off = static locations aren't tracked at all. The full
  // `routes` array still goes to the editors below - it's their lookup table
  // for route names in clause warnings, which may point at a static route.
  const trackable = settings.statics ? routes : routes.filter((r) => r.type === "route");
  const visible = openOnly
    ? trackable.filter((r) => !isRouteDone(r, encounters, isClassic) || r.id === lastTouchedRouteId)
    : trackable;
  const mainRoutes = visible.filter((r) => !r.postgame);
  const postgameRoutes = visible.filter((r) => r.postgame);

  // Overall completion, independent of the "Nur offene" filter above -
  // post-game areas don't count toward "the run" until the league is beaten.
  const progress = computeRouteProgress(routes, encounters, isClassic, settings.statics);

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
          halfDone ? "border-l-2 border-l-warning-line bg-warning-bg/40" : ""
        }`}
      >
        <div className="shrink-0 pt-1.5 sm:w-40">
          {halfDone && (
            <span className="mr-1 text-sm text-warning" title={tTracker.missingPlayer}>
              ⚠
            </span>
          )}
          <span className="font-medium text-ink">{routeName(route, lang)}</span>
          {route.type === "static" && (
            <Badge tone="info" className="ml-1.5 align-middle">
              {tTracker.typeStatic}
            </Badge>
          )}
        </div>
        <div
          className={`grid flex-1 grid-cols-1 gap-3 sm:gap-4 ${isClassic ? "" : "sm:grid-cols-2"}`}
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
              onTouched={setLastTouchedRouteId}
            />
          ) : (
            <>
              <div>
                <span className="mb-1 block text-xs font-medium text-ink-subtle">
                  {playerLabel(Player.PLAYER1)}
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
                  onTouched={setLastTouchedRouteId}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium text-ink-subtle">
                  {playerLabel(Player.PLAYER2)}
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
                  onTouched={setLastTouchedRouteId}
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
      <PageHeader title={tTracker.heading}>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={openOnly ? "primary" : "secondary"}
            aria-pressed={openOnly}
            title={tTracker.openOnlyTitle}
            onClick={() => setOpenOnly((v) => !v)}
          >
            {tTracker.openOnly}
          </Button>
          <ProgressBar
            done={progress.done}
            total={progress.total}
            percent={progress.percent}
            title={tTracker.progressTitle(progress.done, progress.total, progress.percent)}
          />
        </div>
      </PageHeader>

      {visible.length === 0 ? (
        // "Open only" with everything done used to leave an empty bordered
        // frame with no explanation and no way back.
        <EmptyState
          title={tTracker.allDone}
          action={
            <Button size="sm" onClick={() => setOpenOnly(false)}>
              {tTracker.showAll}
            </Button>
          }
        />
      ) : (
        <Card padding="none" className="divide-y divide-line overflow-hidden">
          {mainRoutes.map(renderRoute)}
          {postgameRoutes.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPostgame((v) => !v)}
                className="flex w-full items-center justify-center gap-2 bg-sunken p-3 text-sm font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink"
              >
                <span
                  className={`inline-block transition-transform ${showPostgame ? "rotate-90" : ""}`}
                >
                  ▸
                </span>
                {showPostgame ? tTracker.postgameHide : tTracker.postgameShow(postgameRoutes.length)}
              </button>
              {showPostgame && postgameRoutes.map(renderRoute)}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
