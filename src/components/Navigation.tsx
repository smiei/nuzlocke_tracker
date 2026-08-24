"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { useTabOrder } from "@/components/TabOrderProvider";
import { NavIcon } from "@/components/NavIcon";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { translations } from "@/lib/i18n/dictionary";

export function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const run = searchParams.get("run");
  const { lang } = useLanguage();
  const { order, hidden } = useTabOrder();
  const t = translations[lang].nav;

  const items = order
    .map((href) => NAV_ITEMS.find((item) => item.href === href))
    .filter((item): item is (typeof NAV_ITEMS)[number] => item !== undefined)
    .filter((item) => !hidden.includes(item.href));

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 sm:px-6">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const href = run ? `${item.href}?run=${run}` : item.href;
        return (
          <Link
            key={item.href}
            href={href}
            // Icon over label: eight near-identical text labels are slow to
            // pick out, a shape is recognised without reading. The icon takes
            // its colour from the link, so the active/inactive states below
            // still drive everything.
            // active: gives the tap something to acknowledge in the moment before the
            // route commits. With loading.tsx in place that gap is now short, but
            // on a slow tunnel it is still perceptible.
            className={`flex min-w-16 shrink-0 flex-col items-center gap-1 whitespace-nowrap border-b-2 px-3 pt-2 pb-2 text-xs font-medium transition-colors active:bg-hover ${
              isActive
                ? "border-ink text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <NavIcon href={item.href} className="h-5 w-5" />
            {t[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
