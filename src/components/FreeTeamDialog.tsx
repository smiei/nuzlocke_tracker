"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Pokemon } from "@/lib/data";
import type { RunMode } from "@/generated/prisma/client";
import { Player } from "@/generated/prisma/enums";
import { addFreeTeamMember } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { pokemonName } from "@/lib/i18n/localize";
import { PokemonCombobox } from "@/components/PokemonCombobox";
import { usePlayerLabel } from "@/components/PlayerNamesProvider";
import { NICKNAME_MAX } from "@/components/EncounterEditor";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const NO_LOCKS = new Set<number>();

// Adds a team member without going through the Encounter tab, for a run that
// is not a Nuzlocke. The Species Clause is deliberately not consulted here -
// a free run has no clause to break, and the combobox would otherwise mark
// half the dex as locked.
export function FreeTeamDialog({
  open,
  onClose,
  runId,
  mode,
  lang,
  pokemonList,
}: {
  open: boolean;
  onClose: () => void;
  runId: number;
  mode: RunMode;
  lang: Lang;
  pokemonList: Pokemon[];
}) {
  const router = useRouter();
  const toast = useToast();
  const playerLabel = usePlayerLabel();
  const t = translations[lang].links.free;
  const tDialog = translations[lang].dialog;

  const [pokemonId, setPokemonId] = useState<number | null>(null);
  const [player, setPlayer] = useState<Player>(Player.PLAYER1);
  const [nickname, setNickname] = useState("");
  const [pending, startTransition] = useTransition();

  const isSoulLink = mode !== "CLASSIC";
  const picked = pokemonList.find((p) => p.id === pokemonId) ?? null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pokemonId === null || pending) return;
    const label = picked ? pokemonName(picked, lang) : String(pokemonId);
    startTransition(async () => {
      const result = await addFreeTeamMember(
        runId,
        pokemonId,
        isSoulLink ? player : Player.PLAYER1,
        nickname.trim() || undefined,
      );
      if (result.success) {
        toast.success(t.added(label));
        // Kept open: a team is six of these, and reopening the dialog five
        // times to build one is the annoyance this feature exists to remove.
        setPokemonId(null);
        setNickname("");
        router.refresh();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      size="md"
      dismissOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            {tDialog.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={pending}
            disabled={pokemonId === null}
          >
            {t.submit}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <FieldLabel>{t.pokemonLabel}</FieldLabel>
          <PokemonCombobox
            lang={lang}
            pokemonList={pokemonList}
            selectedId={pokemonId}
            onSelect={setPokemonId}
            onClear={() => setPokemonId(null)}
            lockedFamilyIds={NO_LOCKS}
            disabled={pending}
          />
        </div>

        {isSoulLink && (
          <div>
            <FieldLabel htmlFor="free-team-player">{t.playerLabel}</FieldLabel>
            <Select
              id="free-team-player"
              value={player}
              disabled={pending}
              onChange={(event) =>
                setPlayer(event.target.value === Player.PLAYER2 ? Player.PLAYER2 : Player.PLAYER1)
              }
            >
              <option value={Player.PLAYER1}>{playerLabel(Player.PLAYER1)}</option>
              <option value={Player.PLAYER2}>{playerLabel(Player.PLAYER2)}</option>
            </Select>
          </div>
        )}

        <div>
          <FieldLabel htmlFor="free-team-nickname">{t.nicknameLabel}</FieldLabel>
          <Input
            id="free-team-nickname"
            type="text"
            value={nickname}
            maxLength={NICKNAME_MAX}
            disabled={pending}
            onChange={(event) => setNickname(event.target.value)}
          />
        </div>

        <p className="text-xs text-ink-subtle">{t.hint}</p>
      </div>
    </Modal>
  );
}
