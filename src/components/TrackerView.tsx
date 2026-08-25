"use client";

import { useState, useTransition } from "react";
import type { Route, Pokemon } from "@/lib/data";
import type { Encounter, RunMode } from "@/generated/prisma/client";
import { EncounterStatus, Player } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { routeName } from "@/lib/i18n/localize";
import { isRouteDone, computeRouteProgress } from "@/lib/progress";
import { exportRouteOrder } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { EncounterEditor } from "@/components/EncounterEditor";
import { CustomRoutesDialog } from "@/components/CustomRoutesDialog";
import { DebugOrderDialog } from "@/components/DebugOrderDialog";
import { useToast } from "@/components/ui/ToastProvider";
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
  const [customOpen, setCustomOpen] = useState(false);
  // The report is fetched before the dialog opens rather than inside it, so
  // the dialog needs no loading state and no effect (which would land on the
  // set-state-in-effect lint baseline).
  const [orderText, setOrderText] = useState<string | null>(null);
  const [exporting, startExport] = useTransition();
  const toast = useToast();

  // Every route in display order, for the "insert after" picker - statics
  // included, since an added location may well belong after one.
  const routeOptions = routes.map((route) => ({ id: route.id, name: routeName(route, lang) }));
  const customRoutes = routes
    .filter((route) => route.custom)
    .map((route) => ({
      id: route.id,
      name: routeName(route, lang),
      // Deleting a custom route takes its encounters with it, so the
      // confirmation says how many.
      encounterCount: encounters.filter((e) => e.routeId === route.id).length,
    }));

  function handleExportOrder() {
    startExport(async () => {
      const result = await exportRouteOrder(runId);
      if (result.success) setOrderText(result.text);
      else toast.error(formatActionError(result.error, lang));
    });
  }

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
    const p1 = encounters.find((e) => e.routeId === route.id && e.player === Player.PLAYER1);
    const p2 = isClassic
      ? undefined
      : encounters.find((e) => e.routeId === route.id && e.player === Player.PLAYER2);
    const filled = [p1, p2].filter((e): e is Encounter => e !== undefined);
    // SoulLink: exactly one of the two players has an entry -> the other still
    // owes theirs; the warning sign next to the route name says so.
    const halfDone = !isClassic && filled.length === 1;
    // Every row carries a 4px rail on its left, grey until the route resolves.
    // One lost encounter settles the whole route - in SoulLink the pair can
    // never form, in Classic there is nothing else to wait for - so it outranks
    // "still missing an entry" and a killed encounter reads red even while the
    // other player owes theirs. This is what tells two adjacent routes apart at
    // a glance; a hairline divider between two tall two-column rows does not.
    const lost = filled.some((e) => e.status !== EncounterStatus.CAUGHT);
    const complete = filled.length === (isClassic ? 1 : 2);
    const tone = lost
      ? "border-l-danger-line bg-danger-bg/40"
      : complete
        ? "border-l-success-line bg-success-bg/40"
        : halfDone
          ? "border-l-warning-line bg-warning-bg/40"
          : "border-l-line-strong";
    return (
      <div
        key={route.id}
        className={`flex flex-col gap-3 border-l-4 p-3 sm:flex-row sm:items-start sm:gap-4 sm:p-4 ${tone}`}
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
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            size="sm"
            variant={openOnly ? "primary" : "secondary"}
            aria-pressed={openOnly}
            title={tTracker.openOnlyTitle}
            onClick={() => setOpenOnly((v) => !v)}
          >
            {tTracker.openOnly}
          </Button>
          <Button size="sm" onClick={() => setCustomOpen(true)}>
            {tTracker.custom.manage}
          </Button>
          {settings.debugMode && (
            <Button size="sm" loading={exporting} onClick={handleExportOrder}>
              {tTracker.debug.export}
            </Button>
          )}
          <ProgressBar
            done={progress.done}
            total={progress.total}
            percent={progress.percent}
            title={tTracker.progressTitle(progress.done, progress.total, progress.percent)}
          />
        </div>
      </PageHeader>

      <CustomRoutesDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        runId={runId}
        lang={lang}
        routeOptions={routeOptions}
        customRoutes={customRoutes}
      />
      {orderText !== null && (
        <DebugOrderDialog
          open
          onClose={() => setOrderText(null)}
          lang={lang}
          text={orderText}
          filename={`encounter-order-run-${runId}.txt`}
        />
      )}

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
        <Card padding="none" className="divide-y divide-line-strong overflow-hidden">
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
