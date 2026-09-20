"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Minimal client-side slip store. Phase 5 expands this into full Slip Lab;
 * from today "Add to Slip" has to do something real, not be decoration.
 */

export type SlipLeg = {
  id: string;
  event: string;
  league: string;
  market: string;
  selection: string;
  odds: number | null;
  modelProb: number | null;
  createdAt: string;
};

const KEY = "oddsoracle.slip.v1";

function read(): SlipLeg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SlipLeg[]) : [];
  } catch {
    return [];
  }
}

function write(legs: SlipLeg[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(legs));
  } catch {
    /* storage unavailable — the slip stays in memory for this session */
  }
}

export function useSlip() {
  const [legs, setLegs] = useState<SlipLeg[]>([]);

  useEffect(() => {
    setLegs(read());
    const onStorage = () => setLegs(read());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((leg: Omit<SlipLeg, "createdAt">) => {
    setLegs((prev) => {
      if (prev.some((l) => l.id === leg.id)) return prev;
      const next = [...prev, { ...leg, createdAt: new Date().toISOString() }];
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setLegs((prev) => {
      const next = prev.filter((l) => l.id !== id);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setLegs([]);
    write([]);
  }, []);

  return { legs, add, remove, clear, has: (id: string) => legs.some((l) => l.id === id) };
}
