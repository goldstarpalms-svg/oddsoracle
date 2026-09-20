"use client";

import { useEffect, useState } from "react";

/**
 * Runtime expiry.
 *
 * The board is built once and served statically, so a match that kicked off at
 * 14:00 would otherwise sit on "today's picks" until the next deploy. This
 * module works out when each event started, in the browser, and drops it from
 * the live board as soon as it is over — no rebuild, no cron, no page refresh.
 *
 * Kickoff times on the board are WAT (UTC+1) on the snapshot's data date.
 */

const WAT_OFFSET_HOURS = 1;
/** A football match is treated as finished this long after its kickoff. */
export const DEFAULT_GRACE_MINUTES = 130;

/** "2026-09-20" + "14:30" (WAT) -> epoch ms, or null if unparseable. */
export function kickoffMs(dataDate: string | null | undefined, time: string | null | undefined): number | null {
  if (!dataDate || !time) return null;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataDate));
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim());
  if (!dm || !tm) return null;
  const y = Number(dm[1]), mo = Number(dm[2]) - 1, d = Number(dm[3]);
  const h = Number(tm[1]), mi = Number(tm[2]);
  if (h > 23 || mi > 59) return null;
  // Board times are WAT; Date.UTC is UTC, so subtract the offset.
  return Date.UTC(y, mo, d, h - WAT_OFFSET_HOURS, mi);
}

export function isFinished(
  kickoff: number | null,
  now: number,
  graceMinutes = DEFAULT_GRACE_MINUTES
): boolean {
  if (kickoff == null) return false;
  return now - kickoff > graceMinutes * 60_000;
}

/** Re-renders on an interval so expired events disappear without a refresh. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
