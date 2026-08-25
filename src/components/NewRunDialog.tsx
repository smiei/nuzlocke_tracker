"use client";

import { useEffect, useRef, useState } from "react";
import { RunMode } from "@/generated/prisma/enums";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { localizeName } from "@/lib/i18n/localize";
import type { GameSummary } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export function NewRunDialog({
  lang,
  open,
  pending,
  games,
  initialGameId,
  onClose,
  onCreate,
}: {
  lang: Lang;
  open: boolean;
  pending: boolean;
  games: GameSummary[];
  // Preselected game = the active run's game (new runs usually continue on
  // the same cartridge).
  initialGameId: string;
  onClose: () => void;
  onCreate: (name: string, mode: RunMode, gameId: string) => void;
}) {
  const t = translations[lang].runSwitcher;
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RunMode>(RunMode.SOULLINK);
  const [gameId, setGameId] = useState(initialGameId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setMode(RunMode.SOULLINK);
    setGameId(initialGameId);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open, initialGameId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, mode, gameId);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.newRunTitle}
      // Half a form filled in should survive a stray tap on the backdrop.
      dismissOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button size="sm" disabled={pending} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={pending}
            disabled={!name.trim()}
          >
            {t.create}
          </Button>
        </>
      }
    >
      <div className="mb-3">
        <FieldLabel htmlFor="new-run-name">{t.nameLabel}</FieldLabel>
        <Input
          id="new-run-name"
          ref={inputRef}
          type="text"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
        />
      </div>

      <div className="mb-3">
        <FieldLabel htmlFor="new-run-game">{t.gameLabel}</FieldLabel>
        <Select
          id="new-run-game"
          value={gameId}
          disabled={pending}
          onChange={(e) => setGameId(e.target.value)}
        >
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {localizeName(game.names, lang)}
            </option>
          ))}
        </Select>
      </div>

      {/* Mode is fixed at creation, so it is a two-way choice rather than a
          toggle: both options stay visible and the picked one is filled. */}
      <span className="mb-1 block text-xs font-medium text-ink-muted">{t.modeLabel}</span>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.modeLabel}>
        {(
          [
            [RunMode.SOULLINK, t.modeSoullink],
            [RunMode.CLASSIC, t.modeClassic],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={mode === value ? "primary" : "secondary"}
            aria-pressed={mode === value}
            disabled={pending}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
