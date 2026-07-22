"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";

const ORDER_KEY = "nuzlocke:tabOrder";
const HIDDEN_KEY = "nuzlocke:tabHidden";
const DEFAULT_ORDER = NAV_ITEMS.map((item) => item.href);
const KNOWN = new Set<string>(DEFAULT_ORDER);

// Drops unknown hrefs (removed tabs) and appends missing ones in default
// order (newly added tabs), so a stored order never hides a tab.
function normalize(order: string[]): string[] {
  const known = order.filter((href) => KNOWN.has(href));
  const missing = DEFAULT_ORDER.filter((href) => !known.includes(href));
  return [...known, ...missing];
}

function normalizeHidden(hidden: string[]): string[] {
  return [...new Set(hidden.filter((href) => KNOWN.has(href)))];
}

type TabOrderApi = {
  order: string[];
  setOrder: (order: string[]) => void;
  hidden: string[];
  toggleHidden: (href: string) => void;
  reset: () => void;
  isDefault: boolean;
};

const TabOrderContext = createContext<TabOrderApi | null>(null);

export function useTabOrder(): TabOrderApi {
  const ctx = useContext(TabOrderContext);
  if (!ctx) throw new Error("useTabOrder must be used within a TabOrderProvider");
  return ctx;
}

// Personal UI preference, so it lives in localStorage (per browser) - same
// treatment as the sort preference on the Pokémon tab. First client render
// uses the defaults to match SSR, the stored values apply post-mount.
export function TabOrderProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrderState] = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHiddenState] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      if (raw) setOrderState(normalize(JSON.parse(raw)));
    } catch {
      // Corrupt storage - keep the default order.
    }
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHiddenState(normalizeHidden(JSON.parse(raw)));
    } catch {
      // Corrupt storage - keep nothing hidden.
    }
  }, []);

  const setOrder = useCallback((next: string[]) => {
    const normalized = normalize(next);
    setOrderState(normalized);
    localStorage.setItem(ORDER_KEY, JSON.stringify(normalized));
  }, []);

  const toggleHidden = useCallback((href: string) => {
    setHiddenState((prev) => {
      const next = normalizeHidden(
        prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href],
      );
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setOrderState(DEFAULT_ORDER);
    localStorage.removeItem(ORDER_KEY);
    setHiddenState([]);
    localStorage.removeItem(HIDDEN_KEY);
  }, []);

  const api = useMemo(
    () => ({
      order,
      setOrder,
      hidden,
      toggleHidden,
      reset,
      isDefault: order.join() === DEFAULT_ORDER.join() && hidden.length === 0,
    }),
    [order, setOrder, hidden, toggleHidden, reset],
  );

  return <TabOrderContext.Provider value={api}>{children}</TabOrderContext.Provider>;
}
