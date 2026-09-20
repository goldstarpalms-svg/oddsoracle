"use client";

import { useEffect, useState } from "react";
import { DEFAULT_GRACE_MINUTES, isFinished, kickoffMs } from "./kickoff";

export { DEFAULT_GRACE_MINUTES, isFinished, kickoffMs };

/** Re-renders on an interval so expired events disappear without a refresh. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now ?? 0;
}
