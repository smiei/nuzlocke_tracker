"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useRouter } from "next/navigation";
import type { Pokemon, Route } from "@/lib/data";
import type { Encounter } from "@/generated/prisma/client";
import { EncounterStatus, type Player } from "@/generated/prisma/enums";
import { saveEncounter, clearEncounter } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName, routeName } from "@/lib/i18n/localize";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { PokemonInfoButton } from "@/components/PokemonDetailProvider";
import type { RunSettings } from "@/lib/runSettings";
import { Input } from "@/components/ui/Input";

// In-game nicknames are capped at 10 characters; the input enforces this and
// shows a live counter (the server slices to the same length as a safety net).
// Exported for the Catchrate tab's quick-catch confirm panel, which mirrors
// this same field.
export const NICKNAME_MAX = 10;

// Colour the status control so a route's outcome is readable at a glance:
// green = caught, red = killed, amber = fled.
const STATUS_STYLES: Record<EncounterStatus, string> = {
  CAUGHT: "border-success-line bg-success-bg text-success",
  KILLED: "border-danger-line bg-danger-bg text-danger",
  FLED: "border-warning-line bg-warning-bg text-warning",
};

export function EncounterEditor({
  runId,
  lang,
  settings,
  routeId,
  player,
  routes,
  pokemonList,
  encounters,
  onTouched,
}: {
  runId: number;
  lang: Lang;
  settings: RunSettings;
  routeId: number;
  player: Player;
  routes: Route[];
  pokemonList: Pokemon[];
  encounters: Encounter[];
  // Reports which route was last edited, so the Tracker's "open only" filter
  // can keep it on screen while the rest of the row is filled in.
  onTouched: (routeId: number) => void;
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const t = translations[lang];

  const current = useMemo(
    () => encounters.find((e) => e.routeId === routeId && e.player === player),
    [encounters, routeId, player],
  );

  // EVERY encounter elsewhere - static or not, regardless of outcome
  // (caught/killed/fled) - "uses up" its family_id. Only this exact slot is
  // excluded, so re-saving the same pick doesn't mark itself. Locked families
  // are marked in the dropdown on every route, including static ones (static
  // only means "safe to pick anyway", not "not locked"). With the Species
  // Clause rule off, nothing is marked at all.
  const lockedFamilyIds = useMemo(() => {
    const set = new Set<number>();
    if (!settings.speciesClause) return set;
    for (const e of encounters) {
      if (e.routeId === routeId && e.player === player) continue;
      // Shiny Clause: a shiny catch is exempt and doesn't lock its family.
      if (settings.shinyClause && e.shiny) continue;
      set.add(e.familyId);
    }
    return set;
  }, [settings.speciesClause, settings.shinyClause, encounters, routeId, player]);

  // Tracker always shows what was actually caught (pokemonId); if it has
  // since been evolved in the Links tab (currentPokemonId), name that form
  // in parentheses alongside it, without ever changing the selection here.
  const evolvedName = useMemo(() => {
    if (!current || current.currentPokemonId === current.pokemonId) return null;
    const evolved = pokemonList.find((p) => p.id === current.currentPokemonId);
    return evolved ? pokemonName(evolved, lang) : null;
  }, [current, pokemonList, lang]);

  // While there is no real Encounter yet, another client's unconfirmed pick
  // (draft) fills in for it - so every client shows the same in-progress row
  // even before "Bestätigen". `current` always wins once it exists.
  const [selectedId, setSelectedId] = useState<number | null>(
    current?.pokemonId ?? null,
  );
  const [status, setStatus] = useState<EncounterStatus>(
    current?.status ?? EncounterStatus.CAUGHT,
  );
  const [nickname, setNickname] = useState(current?.nickname ?? "");
  const [nickFocused, setNickFocused] = useState(false);
  const [shiny, setShiny] = useState(current?.shiny ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedName = (() => {
    const p = selectedId != null ? pokemonList.find((x) => x.id === selectedId) : null;
    return p ? pokemonName(p, lang) : "";
  })();

  useEffect(() => {
    setSelectedId(current?.pokemonId ?? null);
    setStatus(current?.status ?? EncounterStatus.CAUGHT);
    setNickname(current?.nickname ?? "");
    setShiny(current?.shiny ?? false);
  }, [
    current?.pokemonId,
    current?.status,
    current?.nickname,
    current?.shiny,
  ]);

  // Static/gift is a fixed property of the location (routes.json `type`),
  // no longer a user-set checkbox.
  const routeIsStatic = (routes.find((r) => r.id === routeId)?.type ?? "route") !== "route";

  // Purely informational Species Clause warning, derived from the run's
  // encounters: the pick is SAVED either way (the server never rejects it).
  // Conflicts count ALL other entries of the family, including statics.
  // Static routes themselves never warn ("safe to pick anyway") - unless the
  // staticsExemptFromClause rule is switched off. On normal routes the
  // warning shows on BOTH sides of a conflict for as long as it exists - a
  // deliberate, stateless rule (no "who was first" timestamp heuristics that
  // could flip when entries are edited later).
  const lockWarning = useMemo(() => {
    if (!settings.speciesClause || selectedId === null) return null;
    // Shiny Clause: a shiny catch is always allowed - no clause warning.
    if (settings.shinyClause && shiny) return null;
    if (routeIsStatic && settings.staticsExemptFromClause) return null;
    const picked = pokemonList.find((p) => p.id === selectedId);
    if (!picked) return null;
    const conflict = encounters.find(
      (e) => e.familyId === picked.family_id && !(e.routeId === routeId && e.player === player),
    );
    if (!conflict) return null;
    const conflictRoute = routes.find((r) => r.id === conflict.routeId);
    return t.actions.speciesLocked(
      pokemonName(picked, lang),
      t.player[conflict.player],
      conflictRoute ? routeName(conflictRoute, lang) : `Route #${conflict.routeId}`,
    );
  }, [settings, shiny, selectedId, routeIsStatic, encounters, routeId, player, pokemonList, routes, lang, t]);

  function persist(next: {
    pokemonId: number;
    status: EncounterStatus;
    nickname?: string | null;
    shiny?: boolean;
  }) {
    setError(null);
    onTouched(routeId);
    startTransition(async () => {
      const result = await saveEncounter({ runId, routeId, player, ...next });
      if (result.success) {
        router.refresh();
      } else {
        setError(formatActionError(result.error, lang));
        // Revert the optimistic UI change - the save was rejected server-side.
        setSelectedId(current?.pokemonId ?? null);
        setStatus(current?.status ?? EncounterStatus.CAUGHT);
        setNickname(current?.nickname ?? "");
        setShiny(current?.shiny ?? false);
      }
    });
  }

  // Every field saves as soon as it changes, new row or not. That used to be
  // gated behind a "Bestätigen" button because saving on the species pick made
  // the row vanish from the Tracker's "open only" filter before a nickname
  // could be typed. The filter now keeps the last-edited route on screen
  // instead (see TrackerView), so the button - and the whole draft-broadcast
  // mechanism it needed - is gone.
  function handleSelectPokemon(pokemonId: number) {
    setSelectedId(pokemonId);
    if (pokemonId !== current?.pokemonId) {
      // A different species = a different individual - its nickname and shiny
      // flag don't carry over. Re-picking the same species keeps them.
      setNickname("");
      setShiny(false);
      persist({ pokemonId, status, nickname: null, shiny: false });
    } else {
      persist({ pokemonId, status });
    }
  }

  function handleShinyToggle() {
    if (selectedId === null) return;
    const next = !shiny;
    setShiny(next);
    persist({ pokemonId: selectedId, status, shiny: next });
  }

  function handleStatusChange(next: EncounterStatus) {
    setStatus(next);
    if (selectedId === null) return;
    persist({ pokemonId: selectedId, status: next });
  }

  // Saved on blur / Enter, not per keystroke - one server action per edit.
  function commitNickname() {
    if (selectedId === null) return;
    const trimmed = nickname.trim();
    if (trimmed === (current?.nickname ?? "")) return;
    persist({ pokemonId: selectedId, status, nickname: trimmed || null });
  }


  // Undo a mistaken entry: remove the encounter entirely. The confirm() must
  // run OUTSIDE startTransition - awaiting a dialog inside a transition keeps
  // it pending on its own show/resolve update and deadlocks the page.
  async function handleClear() {
    setError(null);
    if (!(await confirm({ message: t.tracker.clearConfirm, danger: true }))) return;
    startTransition(async () => {
      const result = await clearEncounter(runId, routeId, player);
      if (result.success) {
        setSelectedId(null);
        setStatus(EncounterStatus.CAUGHT);
        setNickname("");
        router.refresh();
      } else {
        setError(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <div className="flex min-w-[200px] flex-col gap-1.5">
      <PokemonCombobox
        lang={lang}
        pokemonList={pokemonList}
        selectedId={selectedId}
        onSelect={handleSelectPokemon}
        lockedFamilyIds={lockedFamilyIds}
        disabled={pending}
      />
      {evolvedName && <span className="text-xs text-ink-subtle">({evolvedName})</span>}
      {selectedId !== null && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <PokemonInfoButton pokemonId={selectedId} label={selectedName} />
          {settings.shinyClause && (
            <button
              type="button"
              disabled={pending}
              onClick={handleShinyToggle}
              aria-pressed={shiny}
              title={t.tracker.shinyToggle}
              className={`h-10 w-10 shrink-0 rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                shiny
                  ? "border-warning-line bg-warning-bg text-warning"
                  : "border-line text-ink-subtle hover:bg-hover hover:text-ink"
              }`}
            >
              ✨
            </button>
          )}
          <select
            value={status}
            disabled={pending}
            onChange={(e) => handleStatusChange(e.target.value as EncounterStatus)}
            className={`h-10 shrink-0 rounded-md border px-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_STYLES[status]}`}
          >
            {Object.values(EncounterStatus).map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>
          {settings.nicknames && (
            <span className="inline-flex items-center gap-1">
              <Input
                size="sm"
                type="text"
                value={nickname}
                disabled={pending}
                maxLength={NICKNAME_MAX}
                placeholder={t.tracker.nicknamePlaceholder}
                aria-label={t.tracker.nicknameLabel}
                onChange={(e) => setNickname(e.target.value)}
                onFocus={() => setNickFocused(true)}
                onBlur={() => {
                  setNickFocused(false);
                  commitNickname();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-28"
              />
              {/* Live character counter - shown while editing or when filled,
                  amber once the 10-char in-game limit is reached. */}
              {(nickFocused || nickname.length > 0) && (
                <span
                  className={`tabular-nums text-xs ${
                    nickname.length >= NICKNAME_MAX ? "text-warning" : "text-ink-subtle"
                  }`}
                >
                  {nickname.length}/{NICKNAME_MAX}
                </span>
              )}
            </span>
          )}
          {current && (
            <button
              type="button"
              disabled={pending}
              onClick={handleClear}
              title={t.tracker.clear}
              aria-label={t.tracker.clear}
              className="h-10 w-10 shrink-0 rounded-md border border-line text-ink-subtle transition-colors hover:bg-danger-bg hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              🗑
            </button>
          )}
        </div>
      )}
      {/* One indicator for the whole row rather than one per control: every
          field here saves on change, so what matters is that the row is
          talking to the server, not which field started it. */}
      {pending && (
        <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
          <Spinner />
          {t.dialog.saving}
        </span>
      )}
      {lockWarning && <p className="text-xs text-warning">⚠ {lockWarning}</p>}
      {/* Inline rather than a toast: with 30+ rows on screen, the error has to
          point at the row it belongs to. */}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
