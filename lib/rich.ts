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
  mkt_pick: string | null;
  model: ModelInfo | null;
  src: string; // FOREBET | MODEL | FUSION
  final: string; // final pick, e.g. "1"
  ou: string;
  note: string;
  banker: boolean;
  value: boolean;
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
  banker: boolean;
  value: boolean;
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
  combo: { legs: ComboLeg[]; totalOdds: number } | null;
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
    const k1 = final === "1" ? 0 : final === "2" ? 2 : 1;
    if (r.mkt_dec != null && r.mkt_dec > 1) odds = Math.round(r.mkt_dec * 100) / 100;
    else if (pct) {
      if (pct[k1] > 0) odds = Math.round((100 / pct[k1]) * 100) / 100;
    } else if (m && m.p) {
      if (m.p[k1] > 0) odds = implied(m.p[k1]);
    }
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
      mkt_pick: r.mkt_pick || null,
      model: m,
      src: r.src || (pct ? "FOREBET" : "MODEL"),
      final: labelPick(final),
      ou: r.ou || "",
      note: r.note || "",
      banker: maxPct >= 70,
      value: !!(odds && maxPct >= 55 && odds >= 1.6),
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
      banker: !!prob && Math.max(prob[0], prob[1]) >= 70,
      value: !!prob && Math.max(prob[0], prob[1]) >= 55 && odds != null && odds >= 1.5,
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

  // Safe combo: 3 strongest football picks with real probabilities.
  const cands = fb
    .filter((x) => x.fb_pct && Math.max(...x.fb_pct!) >= 65 && x.odds)
    .sort((a, b) => Math.max(...b.fb_pct!) - Math.max(...a.fb_pct!))
    .slice(0, 3);
  let combo: DailySummary["combo"] = null;
  if (cands.length >= 2) {
    const legs: ComboLeg[] = cands.map((x) => ({
      id: x.id,
      home: x.home,
      away: x.away,
      pick: x.final,
      odds: x.odds!,
      prob: Math.max(...x.fb_pct!),
    }));
    combo = {
      legs,
      totalOdds: Math.round(legs.reduce((acc, l) => acc * l.odds, 1) * 100) / 100,
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
