"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addCustomRoute, deleteCustomRoute } from "@/lib/actions";
import { CUSTOM_ROUTE_NAME_MAX } from "@/lib/customRoutes";
import { formatActionError } from "@/lib/actionErrors";
import type { Lang } from "@/lib/i18n/dictionary";
import { translations } from "@/lib/i18n/dictionary";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { FieldLabel, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export type RouteOption = { id: number; name: string };
export type CustomRouteRow = { id: number; name: string; encounterCount: number };

// Add-and-manage in one dialog, same shape as RulePresetDialog - including
// why the delete confirmation is inline rather than a useDialog() call: two
// stacked Modals both catch Escape on `document`.
//
// The position is an anchor ("insert after this route"), not an index. The
// pack's own list can still be reordered underneath - which is precisely what
// the debug export exists to make happen - without the anchor going stale.
export function CustomRoutesDialog({
  open,
  onClose,
  runId,
  lang,
  routeOptions,
  customRoutes,
}: {
  open: boolean;
  onClose: () => void;
  runId: number;
  lang: Lang;
  routeOptions: RouteOption[];
  customRoutes: CustomRouteRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = translations[lang].tracker.custom;
  const tDialog = translations[lang].dialog;

  const [name, setName] = useState("");
  const [type, setType] = useState<"route" | "static">("route");
  // "" is the top of the list; otherwise the id of the route to follow.
  // Defaults to the end, which is where an extra location most often belongs
  // and never silently reorders what is already there.
  const lastId = routeOptions.length > 0 ? String(routeOptions[routeOptions.length - 1].id) : "";
  const [after, setAfter] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const afterValue = after ?? lastId;
  const trimmed = name.trim();

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || pending) return;
    startTransition(async () => {
      const result = await addCustomRoute(
        runId,
        trimmed,
        type,
        afterValue === "" ? null : Number(afterValue),
      );
      if (result.success) {
        toast.success(t.added(trimmed));
        // Keep the dialog open: somebody redefining the statics usually has
        // more than one to enter.
        setName("");
        router.refresh();
      } else {
        toast.error(formatActionError(result.error, lang));
      }
    });
  }

  function handleDelete(row: CustomRouteRow) {
    startTransition(async () => {
      const result = await deleteCustomRoute(runId, row.id);
      if (result.success) {
        setConfirmingId(null);
        toast.success(t.deleted(row.name));
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
      onSubmit={handleAdd}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            {tDialog.cancel}
          </Button>
          <Button type="submit" size="sm" variant="primary" loading={pending} disabled={!trimmed}>
            {t.add}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <FieldLabel htmlFor="custom-route-name">{t.nameLabel}</FieldLabel>
          <Input
            id="custom-route-name"
            type="text"
            value={name}
            maxLength={CUSTOM_ROUTE_NAME_MAX}
            placeholder={t.namePlaceholder}
            disabled={pending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="custom-route-type">{t.typeLabel}</FieldLabel>
            <Select
              id="custom-route-type"
              value={type}
              disabled={pending}
              onChange={(event) => setType(event.target.value === "static" ? "static" : "route")}
            >
              <option value="route">{t.typeRoute}</option>
              <option value="static">{t.typeStatic}</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="custom-route-after">{t.positionLabel}</FieldLabel>
            <Select
              id="custom-route-after"
              value={afterValue}
              disabled={pending}
              onChange={(event) => setAfter(event.target.value)}
            >
              <option value="">{t.positionTop}</option>
              {routeOptions.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-ink-subtle">{t.hint}</p>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {t.existing}
        </h3>
        {customRoutes.length === 0 ? (
          <p className="text-sm text-ink-subtle">{t.none}</p>
        ) : (
          <ul className="divide-y divide-line">
            {customRoutes.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm text-ink">{row.name}</span>
                {confirmingId === row.id ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-ink-muted">{t.deleteConfirm(row.encounterCount)}</span>
                    <Button size="sm" disabled={pending} onClick={() => setConfirmingId(null)}>
                      {tDialog.cancel}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-solid"
                      loading={pending}
                      onClick={() => handleDelete(row)}
                    >
                      {t.deleteYes}
                    </Button>
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={pending}
                    onClick={() => setConfirmingId(row.id)}
                  >
                    {t.delete}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
