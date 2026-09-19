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
  o25: number | null;
  btts: number | null;
  bank: string; // e.g. "SAFE", "RISKY", "ODD"
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
  src: string; // FOREBET | MODEL | FUSION
  final: string; // final pick, e.g. "1"
  ou: string;
  note: string;
  banker: boolean;
  value: boolean;
  why: string; // plain-English "why this pick"
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
          o25: r.model.o25 ?? null,
          btts: r.model.btts ?? null,
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
      src: r.src || (pct ? "FOREBET" : "MODEL"),
      final: labelPick(final),
      ou: r.ou || "",
      note: r.note || "",
      banker: (pickProb ?? maxPct) >= 70,
      value: !!(odds && (pickProb ?? maxPct) >= 55 && odds >= 1.6),
      why,
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

  return {
    generatedAt: SNAPSHOT.generatedAt || "",
    dataDate: SNAPSHOT.dataDate || "",
    total: fb.length + bb.length + tn.length,
    football: fb.length,
    basketball: bb.length,
    tennis: tn.length,
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
