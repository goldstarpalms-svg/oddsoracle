/**
 * trackstats.ts — Track Record 2.0 computations.
 * Everything is derived from the canonical snapshot's settled history.
 * No stat on the page is hand-entered; windows, curves and skill scores
 * all recompute from the raw rows on every build.
 */
import SNAPSHOT from "./data-snapshot.json";

export interface HistRow {
  date: string;
  match: string;
  league: string;
  sport?: string;
  score: string;
  model_pick?: string | null;
  model_prob?: number | null;
  model_win?: number | null;
  odds?: number | null;
  profit?: number | null;
  over25?: string | null;
  model_over25_win?: number | null;
  model_btts?: string | null;
  btts_actual?: string | null;
  model_btts_win?: number | null;
  fb_pick?: string | null;
  fb_win?: number | null;
  market_pick?: string | null;
  market_win?: number | null;
}

export interface WindowStat {
  key: string;
  label: string;
  settled: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  units: number | null;
  roi: number | null;
  avgOdds: number | null;
}

export interface MarketStat {
  label: string;
  n: number;
  hits: number;
  hitRate: number | null;
  roi: number | null;
}

export interface SportStat {
  sport: string;
  n: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  units: number | null;
}

export interface CalibrationBucket {
  bucket: string;
  n: number;
  predicted: number;
  actual: number;
}

export function allRows(): HistRow[] {
  const days = (SNAPSHOT.history as any)?.days || {};
  return Object.entries(days)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1)) // oldest first
    .flatMap(([d, v]: [string, any]) =>
      (v.rows || []).map((r: any) => ({ date: d, ...r }))
    );
}

export function cumulative() {
  return (SNAPSHOT.history as any)?.cumulative || null;
}

/** Window cutoff in local (WAT) date-YYYY-MM-DD. */
function cutoffDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

export function windows(): WindowStat[] {
  const rows = allRows();
  const defs: [string, string, number][] = [
    ["7d", "Last 7 days", 7],
    ["14d", "Last 14 days", 14],
    ["30d", "Last 30 days", 30],
    ["90d", "Last 90 days", 90],
    ["all", "All-time", 0],
  ];
  return defs.map(([key, label, days]) => {
    const cutoff = days ? cutoffDate(days) : "0000";
    const rs = days ? rows.filter((r) => r.date >= cutoff) : rows;
    const withWin = rs.filter((r) => r.model_win != null);
    const wins = withWin.filter((r) => r.model_win === 1).length;
    const losses = withWin.filter((r) => r.model_win === 0).length;
    const profitRows = rs.filter((r) => typeof r.profit === "number");
    const units = profitRows.length
      ? Math.round(profitRows.reduce((a, r) => a + (r.profit as number), 0) * 100) / 100
      : null;
    const staked = profitRows.length;
    const roi = staked ? Math.round((100 * (units as number)) / staked * 10) / 10 : null;
    const oddsRows = rs.filter((r) => typeof r.odds === "number");
    return {
      key,
      label,
      settled: rs.length,
      wins,
      losses,
      hitRate: withWin.length ? Math.round((100 * wins) / withWin.length * 10) / 10 : null,
      units,
      roi,
      avgOdds: oddsRows.length
        ? Math.round((oddsRows.reduce((a, r) => a + (r.odds as number), 0) / oddsRows.length) * 100) / 100
        : null,
    };
  });
}

/** P/L curve: cumulative staked units, oldest first. Rows without odds are win-rate only and excluded from money. */
export function plCurve(): { points: { x: number; y: number; date: string }[]; maxDD: number } {
  const rows = allRows();
  const points: { x: number; y: number; date: string }[] = [{ x: 0, y: 0, date: "start" }];
  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  let x = 0;
  for (const r of rows) {
    if (typeof r.profit !== "number") continue;
    x += 1;
    cum += r.profit;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
    points.push({ x, y: Math.round(cum * 100) / 100, date: r.date });
  }
  return { points, maxDD: Math.round(maxDD * 100) / 100 };
}

const clip = (p: number) => Math.min(0.999, Math.max(0.001, p));

/** Skill scores on the 1X2 call. */
export function skillScores(): { brier: number | null; logloss: number | null; baseline: number; n: number } {
  const rows = allRows().filter((r) => typeof r.model_prob === "number" && r.model_win != null);
  if (!rows.length) return { brier: null, logloss: null, baseline: 1 / Math.E, n: 0 };
  let brier = 0;
  let ll = 0;
  for (const r of rows) {
    const p = clip((r.model_prob as number) / 100);
    const o = r.model_win as number;
    brier += Math.pow(p - o, 2);
    ll += o * Math.log(p) + (1 - o) * Math.log(1 - p);
  }
  return {
    brier: Math.round((brier / rows.length) * 1000) / 1000,
    logloss: Math.round((-ll / rows.length) * 1000) / 1000,
    baseline: 1 / Math.E, // log-loss of an always-50/50 guess
    n: rows.length,
  };
}

export function byMarket(): MarketStat[] {
  const rows = allRows();
  const mk = (label: string, pick: (r: HistRow) => number | null | undefined, hasProfit: boolean) => {
    const rs = rows.filter((r) => pick(r) != null);
    const hits = rs.filter((r) => pick(r) === 1).length;
    const profitRows = hasProfit ? rs.filter((r) => typeof r.profit === "number") : [];
    return {
      label,
      n: rs.length,
      hits,
      hitRate: rs.length ? Math.round((100 * hits) / rs.length * 10) / 10 : null,
      roi:
        hasProfit && profitRows.length
          ? Math.round(
              (100 * profitRows.reduce((a, r) => a + (r.profit as number), 0)) / profitRows.length * 10
            ) / 10
          : null,
    };
  };
  return [
    mk("1X2 match winner", (r) => r.model_win, true),
    mk("Over/Under 2.5", (r) => r.model_over25_win, false),
    mk("Both teams to score", (r) => r.model_btts_win, false),
  ];
}

export function bySport(): SportStat[] {
  const rows = allRows();
  const map = new Map<string, HistRow[]>();
  rows.forEach((r) => {
    const s = r.sport || "Football";
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(r);
  });
  return Array.from(map.entries()).map(([sport, rs]) => {
    const withWin = rs.filter((r) => r.model_win != null);
    const wins = withWin.filter((r) => r.model_win === 1).length;
    const profitRows = rs.filter((r) => typeof r.profit === "number");
    return {
      sport,
      n: rs.length,
      wins,
      losses: withWin.filter((r) => r.model_win === 0).length,
      hitRate: withWin.length ? Math.round((100 * wins) / withWin.length * 10) / 10 : null,
      units: profitRows.length
        ? Math.round(profitRows.reduce((a, r) => a + (r.profit as number), 0) * 100) / 100
        : null,
    };
  });
}

export function auditRows(): HistRow[] {
  return allRows().reverse(); // newest first
}
