"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useDropdown } from "@/lib/useDropdown";
import { useRouter } from "next/navigation";
import type { SoulLinkView } from "@/lib/types";
import { LinkStatus, Player, RunMode } from "@/generated/prisma/enums";
import { clearTeam, markDead, setTeamSlot } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import { useDialog } from "@/components/DialogProvider";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { EncounterTile } from "@/components/EncounterTile";
import { PokemonSprite } from "@/components/PokemonSprite";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { useToast } from "@/components/ui/ToastProvider";

const TEAM_SIZE = 6;

function linkLabel(link: SoulLinkView): string {
  // Prefer nicknames (already gated by the run's `nicknames` rule server-side:
  // null when off, so this falls back to the species name automatically).
  const names = link.encounters.map((e) => e.nickname ?? e.pokemonName);
  return names.length ? names.join(" & ") : link.routeName;
}

// Custom dropdown instead of a native <select> so each option can show the
// link's Pokémon sprites - same pattern as the evolve dropdown.
function SlotPicker({
  slotLabel,
  placeholder,
  current,
  options,
  pending,
  onPick,
}: {
  slotLabel: string;
  placeholder: string;
  current: SoulLinkView | null;
  options: SoulLinkView[];
  pending: boolean;
  onPick: (soulLinkId: number | null) => void;
}) {
  const { open, setOpen, toggle, containerRef } = useDropdown();

  function pick(id: number | null) {
    setOpen(false);
    onPick(id);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={slotLabel}
        disabled={pending}
        onClick={toggle}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-panel px-3 text-left text-sm text-ink transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {current ? (
            <>
              {current.encounters.map((e) => (
                <PokemonSprite key={e.id} pokemonId={e.pokemonId} name={e.pokemonName} size="sm" />
              ))}
              <span className="truncate">{linkLabel(current)}</span>
            </>
          ) : (
            <span className="text-ink-subtle">{placeholder}</span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-xs text-ink-subtle">▾</span>
      </button>
      {open && (
        <ul className="absolute bottom-full z-10 mb-1 max-h-64 w-full min-w-[200px] overflow-y-auto rounded-lg border border-line bg-panel shadow-lg">
          {current && (
            <li>
              <button
                type="button"
                onClick={() => pick(null)}
                className="flex h-10 w-full items-center px-3 text-left text-sm text-ink-subtle hover:bg-hover"
              >
                {placeholder}
              </button>
            </li>
          )}
          {options.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => pick(l.id)}
                className={`flex h-10 w-full items-center gap-2 px-3 text-left text-sm text-ink hover:bg-hover ${
                  current?.id === l.id ? "bg-hover font-medium" : ""
                }`}
              >
                {l.encounters.map((e) => (
                  <PokemonSprite key={e.id} pokemonId={e.pokemonId} name={e.pokemonName} size="sm" />
                ))}
                <span className="truncate">{linkLabel(l)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TeamBar({
  runId,
  mode,
  lang,
  links,
}: {
  runId: number;
  mode: RunMode;
  lang: Lang;
  links: SoulLinkView[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialog();
  const playerLabel = usePlayerLabel();
  const [pending, startTransition] = useTransition();
  const [deadMenuId, setDeadMenuId] = useState<number | null>(null);
  const [deadCause, setDeadCause] = useState("");
  const t = translations[lang];
  const isClassic = mode === RunMode.CLASSIC;

  // Only living links can be on the team; dead ones are filtered out here too
  // (defence in depth - markDead already clears their teamPosition).
  const aliveLinks = links.filter((l) => l.status !== LinkStatus.DEAD);
  const slots: (SoulLinkView | null)[] = Array.from(
    { length: TEAM_SIZE },
    (_, i) => aliveLinks.find((l) => l.teamPosition === i) ?? null,
  );

  function handleSelect(position: number, soulLinkId: number | null) {
    startTransition(async () => {
      const result = await setTeamSlot(runId, position, soulLinkId);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
    });
  }

  // Emptying the whole team. The confirm() must run OUTSIDE startTransition -
  // awaiting a dialog inside one keeps it pending on its own show/resolve
  // update and deadlocks the page (same reason as EncounterEditor's clear).
  async function handleClearTeam() {
    if (!(await confirm({ message: t.links.clearTeamConfirm, danger: true }))) return;
    startTransition(async () => {
      const result = await clearTeam(runId);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
    });
  }

  function handleMarkDead(soulLinkId: number, deathPlayer?: Player) {
    setDeadMenuId(null);
    const cause = deadCause;
    setDeadCause("");
    startTransition(async () => {
      const result = await markDead(runId, soulLinkId, deathPlayer ?? null, cause);
      if (!result.success) toast.error(formatActionError(result.error, lang));
      router.refresh();
    });
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          {t.links.teamHeading}
        </h2>
        {slots.some((l) => l !== null) && (
          <Button size="sm" loading={pending} onClick={handleClearTeam}>
            {t.links.clearTeam}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((link, i) => {
          return (
            <div
              key={i}
              className={`flex flex-col rounded-lg border p-4 ${
                link ? "border-warning-line/50 bg-warning-bg/20" : "border-dashed border-line-strong"
              }`}
            >
              {link ? (
                <>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-ink">{link.routeName}</h3>
                      <p
                        className="text-xs tabular-nums text-ink-subtle"
                        title={t.pokedex.columns.summe}
                      >
                        {(() => {
                          const cur = link.encounters.reduce((s, e) => s + e.summe, 0);
                          const max = link.encounters.reduce((s, e) => s + e.summeMax, 0);
                          return max > cur ? `Σ ${cur} → ${max}` : `Σ ${cur}`;
                        })()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      aria-expanded={deadMenuId === link.id}
                      onClick={() => {
                        setDeadCause("");
                        setDeadMenuId(deadMenuId === link.id ? null : link.id);
                      }}
                    >
                      {t.links.markDead}
                    </Button>
                  </div>

                  {/* Mark-dead menu: optional cause + (SoulLink) who lost theirs. */}
                  {deadMenuId === link.id && (
                    <div className="mb-3 rounded-md border border-danger-line bg-danger-bg/60 p-2">
                      <Input
                        size="sm"
                        type="text"
                        value={deadCause}
                        onChange={(e) => setDeadCause(e.target.value)}
                        maxLength={80}
                        placeholder={t.links.deathCausePlaceholder}
                        aria-label={t.links.deathCausePlaceholder}
                        className="mb-2"
                      />
                      {isClassic ? (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={pending}
                          onClick={() => handleMarkDead(link.id)}
                        >
                          {t.links.markDead}
                        </Button>
                      ) : (
                        <>
                          <p className="mb-1.5 text-xs font-medium text-ink-muted">
                            {t.links.whoLost}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {[Player.PLAYER1, Player.PLAYER2].map((p) => (
                              <Button
                                key={p}
                                size="sm"
                                variant="danger"
                                loading={pending}
                                onClick={() => handleMarkDead(link.id, p)}
                              >
                                {playerLabel(p)}
                              </Button>
                            ))}
                            <Button
                              size="sm"
                              loading={pending}
                              onClick={() => handleMarkDead(link.id)}
                            >
                              {t.links.noAttribution}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col gap-3">
                    {link.encounters.map((e) => (
                      <EncounterTile
                        key={e.id}
                        encounter={e}
                        isDead={false}
                        isClassic={isClassic}
                        lang={lang}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-ink-subtle">
                  <span className="text-3xl leading-none">+</span>
                  <span className="mt-1 text-xs text-ink-subtle">
                    {t.links.teamEmpty}
                  </span>
                </div>
              )}
              <div className="mt-auto pt-3">
                <SlotPicker
                  slotLabel={t.links.teamSlotLabel(i + 1)}
                  placeholder={t.links.teamSelectPlaceholder}
                  current={link}
                  options={aliveLinks}
                  pending={pending}
                  onPick={(id) => handleSelect(i, id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
