/**
 * Kickoff maths (server-safe — no React).
 * Board times are WAT (UTC+1) on the snapshot's data date.
 */
export const WAT_OFFSET_HOURS = 1;
export const DEFAULT_GRACE_MINUTES = 130;

export function kickoffMs(
  dataDate: string | null | undefined,
  time: string | null | undefined
): number | null {
  if (!dataDate || !time) return null;
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataDate));
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(time).trim());
  if (!dm || !tm) return null;
  const h = Number(tm[1]), mi = Number(tm[2]);
  if (h > 23 || mi > 59) return null;
  return Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), h - WAT_OFFSET_HOURS, mi);
}

export function isFinished(
  kickoff: number | null,
  now: number,
  graceMinutes = DEFAULT_GRACE_MINUTES
): boolean {
  if (kickoff == null) return false;
  return now - kickoff > graceMinutes * 60_000;
}
