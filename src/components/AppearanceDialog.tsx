"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";
import { UI_SCALE_DEFAULT, UI_SCALE_STEPS } from "@/lib/uiScale";
import { useUiScale } from "@/lib/useUiScale";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// Opened from the header menu. A real slider rather than five buttons because
// the whole interface resizes live underneath it, which makes dragging it the
// obvious way to find the size you want. (`type="range"` is fine here - the
// convention test bans `type="number"`, whose mobile UA validation fights a
// React-controlled value.)
export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useLanguage();
  const t = translations[lang].appearance;
  const [index, setIndex] = useUiScale();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.title}
      footer={
        <div className="flex w-full justify-between gap-2">
          <Button
            size="sm"
            disabled={index === UI_SCALE_DEFAULT}
            onClick={() => setIndex(UI_SCALE_DEFAULT)}
          >
            {t.reset}
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>
            {t.done}
          </Button>
        </div>
      }
    >
      <label htmlFor="ui-scale" className="mb-1 block text-xs font-medium text-ink-muted">
        {t.sizeLabel}
      </label>
      <input
        id="ui-scale"
        type="range"
        min={0}
        max={UI_SCALE_STEPS.length - 1}
        step={1}
        value={index}
        onChange={(event) => setIndex(Number(event.target.value))}
        list="ui-scale-steps"
        className="h-11 w-full accent-accent"
      />
      <datalist id="ui-scale-steps">
        {UI_SCALE_STEPS.map((_, i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      <div className="flex justify-between text-xs text-ink-subtle">
        <span>{t.smaller}</span>
        <span>{t.normal}</span>
        <span>{t.larger}</span>
      </div>

      {/* The preview is just page text: it already scales with the root font
          size, so it shows the actual result rather than an approximation. */}
      <div className="mt-4 rounded-md border border-line bg-sunken p-3">
        <p className="text-sm text-ink">{t.preview}</p>
        <p className="mt-1 text-xs text-ink-muted">{t.previewSmall}</p>
      </div>
      <p className="mt-3 text-xs text-ink-subtle">{t.hint}</p>
    </Modal>
  );
}
