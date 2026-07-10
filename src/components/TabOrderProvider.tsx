"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";

const STORAGE_KEY = "nuzlocke:tabOrder";
const DEFAULT_ORDER = NAV_ITEMS.map((item) => item.href);

// Drops unknown hrefs (removed tabs) and appends missing ones in default
// order (newly added tabs), so a stored order never hides a tab.
function normalize(order: string[]): string[] {
  const known = order.filter((href) => (DEFAULT_ORDER as string[]).includes(href));
  const missing = DEFAULT_ORDER.filter((href) => !known.includes(href));
  return [...known, ...missing];
}

type TabOrderApi = {
  order: string[];
  setOrder: (order: string[]) => void;
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
// uses the default order to match SSR, the stored order applies post-mount.
export function TabOrderProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrderState] = useState<string[]>(DEFAULT_ORDER);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOrderState(normalize(JSON.parse(raw)));
    } catch {
      // Corrupt storage - keep the default order.
    }
  }, []);

  const setOrder = useCallback((next: string[]) => {
    const normalized = normalize(next);
    setOrderState(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }, []);

  const reset = useCallback(() => {
    setOrderState(DEFAULT_ORDER);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const api = useMemo(
    () => ({
      order,
      setOrder,
      reset,
      isDefault: order.join() === DEFAULT_ORDER.join(),
    }),
    [order, setOrder, reset],
  );

  return <TabOrderContext.Provider value={api}>{children}</TabOrderContext.Provider>;
}
