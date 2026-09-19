import SNAPSHOT from "./data-snapshot.json";

/**
 * Rich data layer — keeps EVERYTHING the daily JSONs contain
 * (forebet 1/X/2 percentages, predicted scores, american coefficients,
 * model probabilities, source of the pick) instead of flattening it
 * into a single tip string.
 */

export interface ModelInfo {
  pick: string;
  p: [number, number, number] | null; // 1/X/2 %
  o15: number | null;
  o25: number | null;
  o35: number | null;
  btts: number | null;
  no_btts: number | null;
  dc1x: number | null;
  dcx2: number | null;
  dc12: number | null;
  dnbH: number | null;
  dnbA: number | null;
  ahH: number | null; // home -1 (win by 2+)
  ahA: number | null; // away -1 (win by 2+)
  cs1: string;
  cs2: string;
  bank: string; // e.g. "BANKER", "SAFE", "MODERATE", "RISKY"
}

export interface FbPick {
  id: string;
  t: string;
  home: string;
  away: string;
  league: string;
  fb_pct: [number, number, number] | null; // forebet 1/X/2 %
  fb_pick: string;
  fb_score: string;
  odds: number | null; // decimal
  oddsSrc: "market" | "implied" | null; // where the displayed odds came from
  pickProb: number | null; // probability of the picked side (%)
  mktImp: number | null; // market-implied probability of the picked side (%)
  edge: number | null; // model prob − market implied prob (pp), only when market odds exist
  mkt_pick: string | null;
  model: ModelInfo | null;
  mktEdge: [number, number, number] | null; // model − market implied (pp) per 1/X/2
  fair: [number, number, number] | null; // model fair decimal odds per 1/X/2
  src: string; // FOREBET | MODEL | FUSION
  final: string; // final pick, e.g. "1"
  ou: string;
  note: string;
  banker: boolean;
  value: boolean;
  why: string; // plain-English "why this pick"
  h2h: H2hData | null; // forebet head-to-head data (past meetings, stats, form)
}

export interface BbPick {
  id: string;
  t: string;
  home: string;
  away: string;
  league: string;
  fb_prob: [number, number] | null; // home/away %
  fb_pick: string;
  fb_score: string;
  fb_avg: number | null;
  fb_coef: string;
  pick: string;
  conf: string; // HIGH | MEDIUM | SPLIT | LOW
  why: string;
  deep: boolean; // deep-crack game (full analysis)
  odds: number | null;
  pickProb: number | null;
  banker: boolean;
  value: boolean;
  opts: OptRow[];
  h2h: H2hData | null;
}

export interface TnPick {
  id: string;
  t: string;
  p1: string;
  p2: string;
  tourn: string;
  prob: [number, number] | null; // p1/p2 %
  pred: string;
  sets: string;
  coef: string;
  odds: number | null;
  pickProb: number | null;
  banker: boolean;
  value: boolean;
  why: string;
  opts: OptRow[];
  h2h: H2hData | null;
}

export interface ComboLeg {
  id: string;
  home: string;
  away: string;
  pick: string;
  odds: number;
  prob: number;
}

export interface DailySummary {
  generatedAt: string;
  dataDate: string;
  total: number;
  football: number;
  basketball: number;
  tennis: number;
  other: number;
  bankers: number;
  scoreCalls: number;
  forebetCovered: number;
  combo: { legs: ComboLeg[]; totalOdds: number; allHitProb: number } | null;
}

// ---------- helpers -------------------------------------------------------

const dec = (american: number): number => {
  if (!isFinite(american) || american === 0) return NaN;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
};

/** Parse american coefficient strings like "+178 / -217" or "-625" → decimal odds for the PICKED side. */
export function americanToDecimal(coef: string | null | undefined): number | null {
  if (!coef || /n\/?a/i.test(coef)) return null;
  const nums = String(coef).match(/[-+]?[0-9]{2,4}/g);
  if (!nums || !nums.length) return null;
  // single number = favourite's odds; pair = "home / away"
  const v = nums[0];
  const d = dec(parseInt(v, 10));
  return isFinite(d) && d > 1 ? Math.round(d * 100) / 100 : null;
}

/** Implied decimal odds for a given probability (self-consistent with the bar). */
const implied = (pct: number): number | null =>
  pct > 1 && pct < 100 ? Math.round((100 / pct) * 100) / 100 : null;

export function probPair(s: string | null | undefined): [number, number] | null {
  if (!s) return null;
  const m = String(s).match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  if (a <= 0 || b <= 0) return null;
  const sum = a + b;
  return [Math.round((a / sum) * 100), Math.round((b / sum) * 100)];
}

const labelPick = (s: string): string =>
  s
    .replace(/^1$/, "Home (1)")
    .replace(/^2$/, "Away (2)")
    .replace(/^X$/, "Draw (X)");

// ---------- football ------------------------------------------------------

export function fbPicks(): FbPick[] {
  const rows = SNAPSHOT.football as any[];
  if (!Array.isArray(rows)) return [];
  const out: FbPick[] = [];
  rows.forEach((r: any, i: number) => {
    if (!r || !r.home || !r.away) return;
    const final = String(r.final || r.fb_pick || "");
    if (!final) return;
    const m: ModelInfo | null = r.model
      ? {
          pick: r.model.pick || "",
          p: Array.isArray(r.model.p) ? (r.model.p as [number, number, number]) : null,
          o15: r.model.o15 ?? null,
          o25: r.model.o25 ?? null,
          o35: r.model.o35 ?? null,
          btts: r.model.btts ?? null,
          no_btts: r.model.no_btts ?? null,
          dc1x: r.model.dc1x ?? null,
          dcx2: r.model.dcx2 ?? null,
          dc12: r.model.dc12 ?? null,
          dnbH: r.model.dnbH ?? null,
          dnbA: r.model.dnbA ?? null,
          ahH: r.model.ahH ?? null,
          ahA: r.model.ahA ?? null,
          cs1: r.model.cs1 || "",
          cs2: r.model.cs2 || "",
          bank: r.model.bank || "",
        }
      : null;
    const pct: [number, number, number] | null =
      Array.isArray(r.fb_pct) && r.fb_pct.length === 3 && r.fb_pct.some((x: number) => x > 0)
        ? (r.fb_pct as [number, number, number])
        : null;
    let odds: number | null = null;
    let oddsSrc: FbPick["oddsSrc"] = null;
    let mktImp: number | null = null;
    const k1 = final === "1" ? 0 : final === "2" ? 2 : 1;
    // Market odds + implied probability for the picked side.
    // mkt_dec / mkt_imp are per-market arrays [1, X, 2] (or scalars in older data).
    const mktDecArr = Array.isArray(r.mkt_dec) ? r.mkt_dec : null;
    const mktImpArr = Array.isArray(r.mkt_imp) ? r.mkt_imp : null;
    const mktDec: number | null = mktDecArr
      ? mktDecArr[k1]
      : typeof r.mkt_dec === "number"
        ? r.mkt_dec
        : null;
    const mktImpRaw: number | null = mktImpArr ? mktImpArr[k1] : null;
    if (typeof mktDec === "number" && mktDec > 1) {
      odds = Math.round(mktDec * 100) / 100;
      oddsSrc = "market";
      mktImp = mktImpRaw ?? Math.round((100 / mktDec) * 10) / 10;
    } else if (pct) {
      if (pct[k1] > 0) odds = Math.round((100 / pct[k1]) * 100) / 100;
      oddsSrc = "implied";
    } else if (m && m.p) {
      if (m.p[k1] > 0) odds = implied(m.p[k1]);
      oddsSrc = "implied";
    }
    // "Model" probability of the picked side (Forebet when covered, else our model)
    const pickProb: number | null = pct ? pct[k1] : m && m.p ? m.p[k1] : null;
    // Edge (pp) = model prob − market implied prob; only shown when real market data exists
    let edge: number | null = null;
    if (oddsSrc === "market" && pickProb != null && mktImp != null) {
      edge = Math.round(pickProb - mktImp);
    }
    const why = [
      pct
        ? `Forebet's own read: ${pct[0]}% home / ${pct[1]}% draw / ${pct[2]}% away${r.fb_pick ? ` — they back ${r.fb_pick}` : ""}.`
        : "Forebet doesn't cover this match, so the pick below comes from our own model.",
      r.fb_score ? `Forebet's predicted score: ${r.fb_score}.` : "",
      m && m.p
        ? `Our model says ${m.p[0]}% / ${m.p[1]}% / ${m.p[2]}% → ${labelPick(String(m.pick || final))}${m.o25 != null ? `; over 2.5 goals ${m.o25}%` : ""}${m.btts != null ? `; both teams to score ${m.btts}%` : ""}${m.bank && m.bank !== "SAFE" ? `; flagged ${m.bank}` : ""}.`
        : "",
      r.src === "FUSION"
        ? "Both Forebet and our model agree on this one, so the call is stronger."
        : r.src === "FOREBET"
          ? "The final call follows Forebet's board."
          : "The final call follows our model.",
      r.ou ? `Total-goals line: ${r.ou}.` : "",
      r.note ? String(r.note) : "",
    ]
      .filter(Boolean)
      .join(" ");
    const maxPct = pct ? Math.max(...pct) : 0;
    out.push({
      id: `fb-${i}`,
      t: r.t || "",
      home: r.home,
      away: r.away,
      league: r.lg || "Football",
      fb_pct: pct,
      fb_pick: r.fb_pick || "",
      fb_score: r.fb_score || "",
      odds,
      oddsSrc,
      pickProb,
      mktImp,
      edge,
      mkt_pick: r.mkt_pick || null,
      model: m,
      mktEdge:
        Array.isArray(r.mktEdge) && r.mktEdge.length === 3
          ? (r.mktEdge as [number, number, number])
          : null,
      fair:
        Array.isArray(r.fair) && r.fair.length === 3 ? (r.fair as [number, number, number]) : null,
      src: r.src || (pct ? "FOREBET" : "MODEL"),
      final: labelPick(final),
      ou: r.ou || "",
      note: r.note || "",
      banker: (pickProb ?? maxPct) >= 70,
      value: !!(odds && (pickProb ?? maxPct) >= 55 && odds >= 1.6),
      why,
      h2h: h2hFor(r.home, r.away),
    });
  });
  return out;
}

// ---------- basketball ----------------------------------------------------

export function bbPicks(): BbPick[] {
  const d = SNAPSHOT.basketball as any;
  if (!d) return [];
  const out: BbPick[] = [];
  const seen = new Set<string>();
  (d.games || []).forEach((g: any, i: number) => {
    if (!g || !g.home || !g.away) return;
    seen.add(`${g.home}|${g.away}`);
    const prob: [number, number] | null =
      Array.isArray(g.fb_prob) && g.fb_prob.length === 2
        ? (g.fb_prob as [number, number])
        : null;
    const conf = String(g.conf || "").toUpperCase();
    const predHome = /^1/.test(String(g.fb_pick || g.pick || ""));
    // odds = implied decimal of the picked side from Forebet's own probability
    const odds = prob ? Math.round((100 / (predHome ? prob[0] : prob[1])) * 100) / 100 : null;
    out.push({
      id: `bb-${i}`,
      t: g.t || "",
      home: g.home,
      away: g.away,
      league: g.league || "Basketball",
      fb_prob: prob,
      fb_pick: g.fb_pick || "",
      fb_score: g.fb_score || "",
      fb_avg: g.fb_avg ?? null,
      fb_coef: g.fb_coef || "",
      pick: g.pick || g.fb_pick || "",
      conf,
      why: g.why || "",
      deep: true,
      odds: odds != null && isFinite(odds) && odds > 1 ? Math.round(odds * 100) / 100 : null,
      pickProb: prob ? (predHome ? prob[0] : prob[1]) : null,
      banker: /HIGH/.test(conf) && !/SPLIT/.test(conf),
      value: /SPLIT|LOW|MEDIUM/.test(conf) || false,
      opts: bbOpts(g, prob),
      h2h: h2hFor(g.home, g.away),
    });
  });
  (d.forebet_today_all || []).forEach((g: any, i: number) => {
    if (!g || !g.match) return;
    const [home, away] = String(g.match).split(/\sv\s/i);
    if (!home || !away) return;
    if (seen.has(`${home}|${away}`)) return;
    const prob = probPair(g.prob);
    const pred = String(g.pred || "");
    const odds = prob ? implied(pred === "1" ? prob[0] : prob[1]) : null;
    out.push({
      id: `bbf-${i}`,
      t: g.t || "",
      home,
      away,
      league: g.league || "Basketball",
      fb_prob: prob,
      fb_pick: pred === "1" ? "1" : "2",
      fb_score: g.score || "",
      fb_avg: g.avg ?? null,
      fb_coef: g.coef || "",
      pick: pred === "1" ? `1 (${home})` : `2 (${away})`,
      conf: "",
      why: g.status ? `Status: ${g.status}.` : "",
      deep: false,
      odds,
      pickProb: prob ? (pred === "1" ? prob[0] : prob[1]) : null,
      banker: !!prob && Math.max(prob[0], prob[1]) >= 68,
      value: !!prob && Math.max(prob[0], prob[1]) >= 55 && odds != null && odds >= 1.6,
      opts: bbOpts(g, prob),
      h2h: h2hFor(home, away),
    });
  });
  return out;
}

// ---------- tennis --------------------------------------------------------

export function tnPicks(): TnPick[] {
  const d = SNAPSHOT.tennis as any;
  if (!d) return [];
  const out: TnPick[] = [];
  (d.games || []).forEach((g: any, i: number) => {
    if (!g || !g.p1 || !g.p2) return;
    const prob = probPair(g.prob);
    const predHome = /^1/.test(String(g.pred || ""));
    // implied decimal of the picked side from Forebet's own probability
    const odds = prob ? implied(predHome ? prob[0] : prob[1]) : null;
    out.push({
      id: `tn-${i}`,
      t: g.t || "",
      p1: g.p1,
      p2: g.p2,
      tourn: g.tourn || "Tennis",
      prob,
      pred: g.pred || "",
      sets: g.sets || "",
      coef: g.coef || "",
      odds,
      pickProb: prob ? (predHome ? prob[0] : prob[1]) : null,
      banker: !!prob && Math.max(prob[0], prob[1]) >= 70,
      value: !!prob && Math.max(prob[0], prob[1]) >= 55 && odds != null && odds >= 1.5,
      why: [
        prob ? `Forebet's probability split: ${prob[0]}% ${g.p1} / ${prob[1]}% ${g.p2}.` : "",
        g.sets ? `Predicted set score: ${g.sets}.` : "",
        g.coef && !/n\/?a/i.test(String(g.coef)) ? `Market coefficient: ${g.coef}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      opts: tnOpts(g, prob),
      h2h: h2hFor(g.p1, g.p2),
    });
  });
  return out;
}

// ---------- summary + combo ----------------------------------------------

export function summary(): DailySummary {
  const fb = fbPicks();
  const bb = bbPicks();
  const tn = tnPicks();
  const bankers =
    fb.filter((x) => x.banker).length +
    bb.filter((x) => x.banker).length +
    tn.filter((x) => x.banker).length;
  const scoreCalls =
    fb.filter((x) => x.fb_score).length +
    bb.filter((x) => x.fb_score).length +
    tn.filter((x) => x.sets).length;
  const forebetCovered = fb.filter((x) => x.fb_pct).length;

  // Daily combo: 3 strongest football picks with real probabilities.
  const cands = fb
    .filter((x) => x.pickProb != null && x.pickProb >= 65 && x.odds)
    .sort((a, b) => (b.pickProb ?? 0) - (a.pickProb ?? 0))
    .slice(0, 3);
  let combo: DailySummary["combo"] = null;
  if (cands.length >= 2) {
    const legs: ComboLeg[] = cands.map((x) => ({
      id: x.id,
      home: x.home,
      away: x.away,
      pick: x.final,
      odds: x.odds!,
      prob: x.pickProb!,
    }));
    combo = {
      legs,
      totalOdds: Math.round(legs.reduce((acc, l) => acc * l.odds, 1) * 100) / 100,
      allHitProb: Math.round(legs.reduce((acc, l) => acc * (l.prob / 100), 1) * 100),
    };
  }

  const any = SNAPSHOT as any;
  const mlbCount = (any.odds?.sports?.baseball_mlb?.events || []).length;
  const ncaaCount = (any.ncaafb?.games || []).length;
  const other = mlbCount + ncaaCount;

  return {
    generatedAt: SNAPSHOT.generatedAt || "",
    dataDate: SNAPSHOT.dataDate || "",
    total: fb.length + bb.length + tn.length,
    football: fb.length,
    basketball: bb.length,
    tennis: tn.length,
    other,
    bankers,
    scoreCalls,
    forebetCovered,
    combo,
  };
}

export type Freshness = {
  level: "fresh" | "recent" | "stale";
  label: string; // e.g. "Fresh · updated today 07:12 WAT"
};

/** Freshness of the snapshot, judged from when it was generated (timezone-safe). */
export function freshness(): Freshness {
  const gen = SNAPSHOT.generatedAt;
  if (!gen) return { level: "stale", label: "Waiting for the first data drop" };
  const dt = new Date(gen);
  const hours = (Date.now() - dt.getTime()) / 36e5;
  const when = dt.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
  if (hours < 36) return { level: "fresh", label: `Fresh · updated ${when} WAT` };
  if (hours < 60) return { level: "recent", label: `Recent · updated ${when} WAT` };
  return { level: "stale", label: `Stale · last updated ${when} WAT` };
}

export function fmtDate(d: string): string {
  if (!d) return "today";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-NG", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return d;
  }
}

// ---------- American sports (MLB + NCAA football) — same card experience -----
export interface AmBook {
  name: string;
  home: number | null;
  away: number | null;
  totals: { line: number | null; over: number | null; under: number | null }[];
  spreads: { point: number | null; home: number | null; away: number | null }[];
}

// ---------- H2H (forebet's head-to-head data, fetched per game) ----------

export interface H2hData {
  h2h: string[][]; // [date, "H-A", pastHome, pastAway]...
  stats?: Record<string, [string, string]>;
  form?: { home?: string; away?: string };
}

const H2H_MAP: Record<string, H2hData> = ((SNAPSHOT as any).h2h?.games as any) || {};

function h2hFor(home: string, away: string): H2hData | null {
  for (const key of Object.keys(H2H_MAP)) {
    const [h, a] = key.split("|");
    if (mmatch(h, home) && mmatch(a, away)) return H2H_MAP[key];
  }
  return null;
}

/** One options-menu row summarising the head-to-head record, oriented to today's home side. */
export function h2hRow(d: H2hData, home: string, away: string, unit: "goals" | "points" | "games"): OptRow | null {
  const m = (d.h2h || []).slice(0, 5);
  if (!m.length) return null;
  let homeWins = 0, awayWins = 0, draws = 0;
  const totals: number[] = [];
  const recent: string[] = [];
  m.forEach((row) => {
    const sc = String(row[1] || "");
    const [a, b] = sc.split("-").map(Number);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    const n1 = String(row[2] || ""), n2 = String(row[3] || "");
    // past meeting may have been played in reverse — orient to today's home side
    let h = a, g = b;
    if (n1 && n2 && mmatch(n1, away) && mmatch(n2, home) && !(mmatch(n1, home) && mmatch(n2, away))) {
      h = b;
      g = a;
    }
    if (h > g) homeWins++;
    else if (g > h) awayWins++;
    else draws++;
    totals.push(h + g);
    recent.push(`${sc} (${row[0]})`);
  });
  const n = totals.length;
  if (!n) return null;
  const avg = Math.round((totals.reduce((s, x) => s + x, 0) / n) * 10) / 10;
  let detail = `${n} past meetings · ${homeWins} ${home} / ${awayWins} ${away} / ${draws} draw`;
  if (unit === "goals") {
    const overs = totals.filter((t) => t > 2.5).length;
    detail += ` · ${overs} of ${n} over 2.5 goals`;
  } else {
    detail += ` · avg ${avg} ${unit} per meeting`;
  }
  detail += ` · last: ${recent.slice(0, 3).join(", ")}`;
  const best = Math.max(homeWins, awayWins);
  return {
    name: "Head-to-head (forebet)",
    detail,
    call: homeWins > awayWins ? `${home} edge in history` : awayWins > homeWins ? `${away} edge in history` : "Even history",
    tag: Math.round((100 * best) / n),
  };
}

/** O/U context from H2H: "H2H: 3 of 5 past meetings over 2.5" (football only). */
export function h2hOuCtxt(d: H2hData): string | null {
  const totals: number[] = [];
  (d.h2h || []).slice(0, 5).forEach((row) => {
    const [a, b] = String(row[1] || "").split("-").map(Number);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    totals.push(a + b);
  });
  if (!totals.length) return null;
  const overs = totals.filter((t) => t > 2.5).length;
  return `H2H: ${overs} of ${totals.length} past meetings over 2.5`;
}

// ---------- all-options menus (what the Nigerian bookies list, with OUR call) ----------
// Markets are aligned to what SportyBet / 1xBet / Bet9ja / Nairabet list:
// football: 1X2, O/U, BTTS, D/C, DNB, handicap, CS  · basketball: result, total points, spread
// tennis: result, total games, games handicap, straight sets  · afoot/MLB: ML, total, spread/run line

export interface OptRow {
  name: string;
  detail: string;
  call: string;
  tag: number | null; // our confidence % (null = no call)
}

// standard normal CDF (Abramowitz & Stegun approx) — used to turn an expected total into P(over)
function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const halfLine = (n: number): number => Math.floor(n - 0.5) + 0.5; // half-point line just below expectation

// BASKETBALL — from forebet's form-based split + predicted score
function bbOpts(g: any, prob: [number, number] | null): OptRow[] {
  if (!prob) return [];
  const [p1, p2] = prob;
  const favH = p1 >= p2;
  const pFav = Math.max(p1, p2);
  const rows: OptRow[] = [
    { name: "Match result (1/2)", detail: `Home ${p1}% · Away ${p2}%`, call: favH ? "1 (Home)" : "2 (Away)", tag: pFav },
  ];
  const s = String(g.fb_score || g.score || "");
  const [sh, sa] = s.split("-").map((x) => Number.parseFloat(x));
  const E = Number.isFinite(sh) && Number.isFinite(sa) ? sh + sa : (g.fb_avg ?? g.avg ?? null);
  if (E) {
    const avgLine = g.fb_avg ?? g.avg ?? E;
    const line = Math.round(avgLine * 2) / 2;
    const pOver = Math.round(normCdf(((E as number) - line) / 13) * 100);
    rows.push({
      name: "Total points (over/under)",
      detail: `Line ${line} · we expect about ${Math.round(E as number)} points from the two teams' form`,
      call: pOver >= 50 ? `Over ${line}` : `Under ${line}`,
      tag: Math.max(pOver, 100 - pOver),
    });
  }
  if (Math.abs(p1 - p2) >= 8) {
    const m = Math.abs(p1 - p2) * 0.25; // expected point margin
    const pCover = Math.round(pFav * normCdf((m - 1.5) / 11));
    rows.push({
      name: "Point spread (−1.5)",
      detail: `${favH ? g.home : g.away} must win by 2+`,
      call: pCover >= 50 ? `${favH ? g.home : g.away} −1.5` : `Underdog +1.5`,
      tag: Math.max(pCover, 100 - pCover),
    });
  } else {
    rows.push({ name: "Point spread", detail: "Teams within 8% — no clean side", call: "Too close — skip", tag: null });
  }
  const h = h2hFor(g.home, g.away);
  if (h) {
    const hr = h2hRow(h, g.home, g.away, "points");
    if (hr) rows.push(hr);
  }
  return rows;
}

// TENNIS — from forebet's split + predicted set score
function tnOpts(g: any, prob: [number, number] | null): OptRow[] {
  if (!prob) return [];
  const [p1, p2] = prob;
  const favH = p1 >= p2;
  const pFav = Math.max(p1, p2);
  const favName = favH ? g.p1 : g.p2;
  const rows: OptRow[] = [
    { name: "Match result (1/2)", detail: `${g.p1} ${p1}% · ${g.p2} ${p2}%`, call: favH ? "1 (First listed)" : "2 (Second listed)", tag: pFav },
  ];
  const msets = String(g.sets || "").match(/(\d)\s*-\s*(\d)/);
  const nSets = msets ? Number.parseInt(msets[1]) + Number.parseInt(msets[2]) : pFav >= 62 ? 2 : 3;
  const E = 11.2 * nSets + 0.5; // a set runs about 11 games
  const line = halfLine(E);
  const pOver = Math.round(normCdf((E - line) / 3) * 100);
  rows.push({
    name: "Total games (over/under)",
    detail: `Line ${line} · we expect about ${Math.round(E)} games in a ${nSets}-set match`,
    call: pOver >= 50 ? `Over ${line}` : `Under ${line}`,
    tag: Math.max(pOver, 100 - pOver),
  });
  if (pFav >= 60) {
    const margin = (pFav - Math.min(p1, p2)) * 20; // expected game margin
    const pCover = Math.round(pFav * normCdf((margin - 4.5) / 3));
    rows.push({
      name: "Games handicap (−4.5)",
      detail: `${favName} must win by 5+ games overall`,
      call: pCover >= 50 ? `${favName} −4.5` : `Underdog +4.5`,
      tag: Math.max(pCover, 100 - pCover),
    });
  }
  if (nSets === 2) {
    const pSS = Math.round(Math.pow(pFav / 100, 2) * 100);
    rows.push({ name: "Straight sets (2-0)", detail: `${favName} wins both sets`, call: pSS >= 50 ? "Yes" : "No", tag: Math.max(pSS, 100 - pSS) });
  }
  const h = h2hFor(g.p1, g.p2);
  if (h) {
    const hr = h2hRow(h, g.p1, g.p2, "games");
    if (hr) rows.push(hr);
  }
  return rows;
}

// AMERICAN FOOTBALL (NCAA) — from forebet's split + predicted score
function amOptsAfoot(g: any, p1: number, p2: number): OptRow[] {
  const favH = p1 >= p2;
  const pFav = Math.max(p1, p2);
  const rows: OptRow[] = [
    { name: "Match result (1/2)", detail: `Home ${p1}% · Away ${p2}%`, call: favH ? "1 (Home)" : "2 (Away)", tag: pFav },
  ];
  const [sh, sa] = String(g.score || "").split("-").map((x) => Number.parseFloat(x));
  const E = Number.isFinite(sh) && Number.isFinite(sa) ? sh + sa : null;
  if (E) {
    const line = halfLine(E);
    const pOver = Math.round(normCdf((E - line) / 13) * 100);
    rows.push({
      name: "Total points (over/under)",
      detail: `Line ${line} · we expect about ${Math.round(E)} points from both teams' form`,
      call: pOver >= 50 ? `Over ${line}` : `Under ${line}`,
      tag: Math.max(pOver, 100 - pOver),
    });
    const m = Math.abs(p1 - p2) * 30; // expected point margin
    const pCover = Math.round(pFav * normCdf((m - 3.5) / 10));
    rows.push({
      name: "Point spread (−3.5)",
      detail: `${favH ? g.home : g.away} must win by 4+`,
      call: pCover >= 50 ? `${favH ? g.home : g.away} −3.5` : `Underdog +3.5`,
      tag: Math.max(pCover, 100 - pCover),
    });
  }
  const h = h2hFor(g.home, g.away);
  if (h) {
    const hr = h2hRow(h, g.home, g.away, "points");
    if (hr) rows.push(hr);
  }
  return rows;
}

// MLB — no form model, so we show the market's own consensus (books' average), labelled honestly
function mlbOpts(e: any): OptRow[] {
  const rows: OptRow[] = [];
  const h2h: any = e.h2h || {};
  const hnames = Object.keys(h2h);
  if (hnames.length) {
    const hAvg = hnames.reduce((s: number, n) => s + h2h[n].home, 0) / hnames.length;
    const aAvg = hnames.reduce((s: number, n) => s + h2h[n].away, 0) / hnames.length;
    const ih = 1 / hAvg, ia = 1 / aAvg, t = ih + ia;
    const p1 = Math.round((ih / t) * 100);
    rows.push({
      name: "Moneyline (1/2)",
      detail: `${e.home} ${p1}% · ${e.away} ${100 - p1}% (book average, vig removed)`,
      call: p1 >= 50 ? `1 (${e.home})` : `2 (${e.away})`,
      tag: Math.max(p1, 100 - p1),
    });
  }
  const tot: any = e.totals || {};
  const tnames = Object.keys(tot);
  if (tnames.length) {
    const lines: Record<string, number> = {};
    tnames.forEach((n) => {
      const L = String(tot[n].line);
      lines[L] = (lines[L] || 0) + 1;
    });
    const line = Object.entries(lines).sort((a, b) => b[1] - a[1])[0][0];
    const oAvg = tnames.reduce((s: number, n) => s + tot[n].over, 0) / tnames.length;
    const uAvg = tnames.reduce((s: number, n) => s + tot[n].under, 0) / tnames.length;
    const io = 1 / oAvg, iu = 1 / uAvg, t2 = io + iu;
    const pOver = Math.round((io / t2) * 100);
    rows.push({
      name: "Total runs (over/under)",
      detail: `Line ${line} · books average over ${oAvg.toFixed(2)} / under ${uAvg.toFixed(2)}`,
      call: pOver >= 50 ? `Over ${line}` : `Under ${line}`,
      tag: Math.max(pOver, 100 - pOver),
    });
  }
  const sp: any = e.spreads || {};
  const snames = Object.keys(sp);
  if (snames.length) {
    const pts: Record<string, number> = {};
    snames.forEach((n) => {
      const L = String(sp[n].point);
      pts[L] = (pts[L] || 0) + 1;
    });
    const pt = Number(Object.entries(pts).sort((a, b) => b[1] - a[1])[0][0]);
    const hAvg = snames.reduce((s: number, n) => s + sp[n].home, 0) / snames.length;
    const aAvg = snames.reduce((s: number, n) => s + sp[n].away, 0) / snames.length;
    const ih = 1 / hAvg, ia = 1 / aAvg, t3 = ih + ia;
    const pH = Math.round((ih / t3) * 100);
    rows.push({
      name: "Run line",
      detail: `Line ${pt} · book average over/under vig`,
      call: pH >= 50 ? `Favourite ${pt}` : `Underdog +${Math.abs(pt)}`,
      tag: Math.max(pH, 100 - pH),
    });
  }
  return rows;
}

export interface AmPick {
  kind: "am";
  id: string;
  sport: "MLB" | "American Football";
  t: string;
  home: string;
  away: string;
  league: string;
  prob: [number, number] | null; // home/away %
  pickSide: "1" | "2";
  pick: string; // display pick (team name)
  odds: number | null; // best odds for the picked side
  pickProb: number | null;
  score: string; // predicted score (NCAA) or "" (MLB)
  total: number | null; // main total line
  banker: boolean;
  value: boolean;
  why: string;
  books: AmBook[]; // every bookmaker's full markets (empty until prices load)
  opts: OptRow[]; // the market menu with OUR calls
  h2h: H2hData | null;
}

const watTime = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
};

export function mlbPicks(): AmPick[] {
  const events: any[] = (SNAPSHOT as any).odds?.sports?.baseball_mlb?.events || [];
  const out: AmPick[] = [];
  events.forEach((e, i) => {
    let oh: [number, string] | null = null;
    let oa: [number, string] | null = null;
    const lineCount: Record<number, number> = {};
    for (const [bk, v] of Object.entries<any>(e.h2h || {})) {
      if (typeof v.home === "number" && v.home > 1 && (!oh || v.home < oh[0])) oh = [v.home, bk];
      if (typeof v.away === "number" && v.away > 1 && (!oa || v.away < oa[0])) oa = [v.away, bk];
    }
    for (const v of Object.values<any>(e.totals || {})) if (typeof v.line === "number") lineCount[v.line] = (lineCount[v.line] || 0) + 1;
    const total =
      Object.entries(lineCount)
        .map(([k, v]) => [Number(k), v] as [number, number])
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (!oh || !oa) return;
    const ih = 100 / oh[0];
    const ia = 100 / oa[0];
    const norm = ih + ia;
    const prob: [number, number] = [Math.round((ih / norm) * 100), Math.round((ia / norm) * 100)];
    const pickHome = ih >= ia;
    const pickProb = Math.round(pickHome ? ih : ia);
    const books: AmBook[] = Object.entries<any>(e.h2h || {}).map(([bk, v]) => ({
      name: bk,
      home: typeof v.home === "number" ? v.home : null,
      away: typeof v.away === "number" ? v.away : null,
      totals:
        e.totals?.[bk] != null
          ? [
              {
                line: typeof e.totals[bk].line === "number" ? e.totals[bk].line : null,
                over: typeof e.totals[bk].over === "number" ? e.totals[bk].over : null,
                under: typeof e.totals[bk].under === "number" ? e.totals[bk].under : null,
              },
            ]
          : [],
      spreads:
        e.spreads?.[bk] != null
          ? [
              {
                point: e.spreads[bk].point ?? null,
                home: typeof e.spreads[bk].home === "number" ? e.spreads[bk].home : null,
                away: typeof e.spreads[bk].away === "number" ? e.spreads[bk].away : null,
              },
            ]
          : [],
    }));
    out.push({
      kind: "am",
      id: `mlb-${i}`,
      sport: "MLB",
      t: watTime(e.start || ""),
      home: e.home,
      away: e.away,
      league: "MLB",
      prob,
      pickSide: pickHome ? "1" : "2",
      pick: pickHome ? e.home : e.away,
      odds: pickHome ? oh[0] : oa[0],
      pickProb,
      score: "",
      total,
      banker: pickProb >= 80,
      value: false,
      why: `Market favourite — best moneyline ${pickHome ? oh[0] : oa[0]} across ${Object.keys(e.h2h || {}).length} bookmakers.`,
      books,
      opts: mlbOpts(e),
      h2h: h2hFor(e.home, e.away),
    });
  });
  return out.sort((a, b) => a.t.localeCompare(b.t));
}

const mnorm = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/fc|cf|sc|ac|club|cd|ud|sd|real|de|fk/g, " ")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const mmatch = (a: string, b: string): boolean => {
  const x = mnorm(a), y = mnorm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

export function ncaaFbPicks(): AmPick[] {
  const games: any[] = (SNAPSHOT as any).ncaafb?.games || [];
  const afBooks: any[] = (SNAPSHOT as any).markets?.americanfootball || [];
  const out: AmPick[] = [];
  games.forEach((g, i) => {
    const [p1, p2] = String(g.prob || "50/50").split("/").map((x) => Number(x));
    if (!p1 || !p2) return;
    const pickHome = String(g.pred) === "1";
    const favPct = pickHome ? p1 : p2;
    const m = afBooks.find((t) => mmatch(t.home, g.home) && mmatch(t.away, g.away));
    const books: AmBook[] = (m?.bookmakers || []).map((b: any) => {
      // h2h is either [home, away] (2-way) or [home, draw, away] (3-way)
      const h2h = Array.isArray(b.h2h) ? b.h2h : null;
      const home = h2h && typeof h2h[0] === "number" ? h2h[0] : null;
      const away = h2h && typeof h2h[h2h.length - 1] === "number" ? h2h[h2h.length - 1] : null;
      return {
        name: b.name,
        home,
        away,
        totals: (b.totals || []).map((t: any) => ({
          line: typeof t.line === "number" ? t.line : null,
          over: typeof t.over === "number" ? t.over : null,
          under: typeof t.under === "number" ? t.under : null,
        })),
        spreads: (b.spreads || []).map((sp: any) => ({
          point: sp.point ?? null,
          home: typeof sp.home === "number" ? sp.home : null,
          away: typeof sp.away === "number" ? sp.away : null,
        })),
      };
    });
    out.push({
      kind: "am",
      id: `afoot-${i}`,
      sport: "American Football",
      t: g.t || "",
      home: g.home,
      away: g.away,
      league: g.league || "NCAA",
      prob: [p1, p2],
      pickSide: pickHome ? "1" : "2",
      pick: pickHome ? g.home : g.away,
      odds: Math.round((100 / favPct) * 100) / 100,
      pickProb: favPct,
      score: g.score || "",
      total: null,
      banker: favPct >= 80,
      value: false,
      why: `Forebet split ${p1}/${p2} · predicted score ${g.score || "—"}.`,
      books,
      opts: amOptsAfoot(g, p1, p2),
      h2h: h2hFor(g.home, g.away),
    });
  });
  return out.sort((a, b) => a.t.localeCompare(b.t));
}
