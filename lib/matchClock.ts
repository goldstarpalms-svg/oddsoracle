/**
 * Shared match-clock logic (client-side, no server round-trip).
 *
 * Times on the site are WAT wall-clock (Lagos). Board rows carry `t` in one
 * of two shapes:
 *   "16:00"          — same day as the board's dataDate
 *   "21/9 06:00"     — explicit day (next-day games like KBO/NPB)
 * An ISO string (MLB odds feed) is also supported.
 *
 * GameGate uses this to auto-remove finished games (or show their final
 * score) the moment they end — without waiting for the next deploy.
 */

/** Parse a board time into a millisecond epoch (visitor-local wall clock). */
export function parseKickoff(
  t: string | null | undefined,
  iso: string | null | undefined,
  dataDate?: string | null
): number | null {
  if (iso) {
    const p = Date.parse(iso);
    return Number.isNaN(p) ? null : p;
  }
  if (!t) return null;
  const s = String(t).trim();
  let y = new Date().getFullYear();
  let md: [number, number] | null = null;
  let hm: RegExpMatchArray | null = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    // same day as the board date (default today in the visitor's clock)
    if (dataDate) {
      const dm = dataDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dm) {
        y = Number(dm[1]);
        md = [Number(dm[2]), Number(dm[3])];
      }
    }
  } else {
    hm = s.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
    if (hm) md = [Number(hm[2]), Number(hm[1])];
  }
  if (!hm || !md) return null;
  const h = hm[2] !== undefined && /^\d{1,2}\/\d{1,2}/.test(s) ? Number(hm[3]) : Number(hm[1]);
  const mi = hm[2] !== undefined && /^\d{1,2}\/\d{1,2}/.test(s) ? Number(hm[4]) : Number(hm[2]);
  const d = new Date();
  d.setFullYear(y);
  d.setMonth(md[0] - 1, md[1]);
  d.setHours(h, mi, 0, 0);
  return d.getTime();
}

/** Typical total match length + buffer (minutes) per sport. */
export const SPORT_DUR: Record<string, number> = {
  football: 165, // 90' + half-time + buffer
  basketball: 165,
  ncaafb: 210,
  hockey: 150,
  baseball: 240,
  handball: 125,
  tennis: 180,
};

export type MatchState = "upcoming" | "live" | "done";

export function matchState(
  t: string | null | undefined,
  now: number,
  durMin: number,
  dataDate?: string | null,
  iso?: string | null
): MatchState | null {
  const start = parseKickoff(t, iso, dataDate);
  if (start == null) return null;
  if (now < start - 15 * 60000) return "upcoming";
  if (now >= start + durMin * 60000) return "done";
  return "live";
}
