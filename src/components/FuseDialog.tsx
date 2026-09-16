"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Player } from "@/generated/prisma/client";
import { fuseEncounters } from "@/lib/actions";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import type { FusableEncounter } from "@/lib/types";
import { useFusionSprites } from "@/components/SpriteSetProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

// Loads without needing the CDN to send CORS headers (reading pixels would,
// a plain load/error event doesn't) - same trick the reference tracker's own
// sprite-variant picker uses.
function imageLoads(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function FuseDialog({
  open,
  onClose,
  runKey,
  hostEncounterId,
  hostPokemonId,
  hostPlayer,
  candidates,
  lang,
  customSpritesOnly,
}: {
  open: boolean;
  onClose: () => void;
  runKey: string;
  hostEncounterId: number;
  hostPokemonId: number;
  hostPlayer: Player;
  // Run-wide fusable list (see links/page.tsx) - filtered to this player and
  // not-the-host here.
  candidates: FusableEncounter[];
  lang: Lang;
  // Challenge rule: warn (never block) when the chosen pair has no
  // hand-drawn sprite, only an algorithmically generated one.
  customSpritesOnly: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const fusion = useFusionSprites();
  const t = translations[lang].links;
  const [donorId, setDonorId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const ownCandidates = candidates.filter((c) => c.player === hostPlayer && c.id !== hostEncounterId);
  const donorPokemonId = candidates.find((c) => c.id === donorId)?.pokemonId ?? null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (donorId === null || pending) return;
    startTransition(async () => {
      if (customSpritesOnly && fusion && donorPokemonId !== null) {
        const headIf = fusion.ifIdByOurId[hostPokemonId];
        const bodyIf = fusion.ifIdByOurId[donorPokemonId];
        if (headIf != null && bodyIf != null) {
          const customUrl = `${fusion.spriteBase}/${fusion.customPath}/${headIf}.${bodyIf}.png`;
          const hasCustom = await imageLoads(customUrl);
          if (!hasCustom) {
            // Distinguish "no hand-drawn art for this pair" from "the CDN
            // itself is unreachable" by probing the head's own single
            // sprite, which almost every species has.
            const headOnlyUrl = `${fusion.spriteBase}/${fusion.customPath}/${headIf}.png`;
            const cdnReachable = await imageLoads(headOnlyUrl);
            toast.info(cdnReachable ? t.fuseNoCustomSprite : t.fuseCdnUnreachable);
          }
        }
      }

      const result = await fuseEncounters(runKey, hostEncounterId, donorId);
      if (result.success) {
        toast.success(t.fuseSuccess);
        setDonorId(null);
        router.refresh();
        onClose();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.fuseDialogTitle}
      size="sm"
      dismissOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            {translations[lang].dialog.cancel}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="primary"
            loading={pending}
            disabled={donorId === null}
          >
            {t.fuseSubmit}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-subtle">{t.fuseDialogHint}</p>
        {ownCandidates.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.fuseNoCandidates}</p>
        ) : (
          <div>
            <FieldLabel htmlFor="fuse-donor">{t.fuseDonorLabel}</FieldLabel>
            <Select
              id="fuse-donor"
              value={donorId ?? ""}
              disabled={pending}
              onChange={(event) => setDonorId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">—</option>
              {ownCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.pokemonName} ({c.routeName})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </Modal>
  );
}
