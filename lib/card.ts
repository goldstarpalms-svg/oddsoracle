import type { BbPick, FbPick, TnPick } from "./rich";
import {
  classifyValue,
  confidenceOf,
  dataQuality,
  evPct,
  oddsFreshness,
  type DataQuality,
  type ValueClass,
} from "./value";

/**
 * One card shape for every sport.
 *
 * The site used to render four different card components with four different
 * ideas of what "confidence" meant. Every board now normalises into this model
 * first, so the numbers on a table-tennis card mean exactly what they mean on a
 * football card — and anything we could not compute stays null instead of being
 * filled in with something that looks like a number.
 */

export type CardModel = {
  id: string;
  sport: string;
  sportIcon: string;
  league: string;
  kickoff: string;
  status: "UPCOMING" | "LIVE" | "SETTLED" | "STALE";

  home: string;
  away: string;

  market: string;
  selection: string;

  modelProb: number | null;   // 0–1
  marketProb: number | null;  // 0–1, de-vigged
  edgePp: number | null;      // percentage points
  odds: number | null;        // decimal
  ev: number | null;          // fraction

  priced: boolean;            // false = no verified book price, so no EV
  oddsSource: "book" | "implied" | null; // where the displayed price came from
  value: ValueClass;
  quality: { level: DataQuality; score: number; reasons: string[] };
  confidence: { level: "High" | "Medium" | "Low"; note: string };

  banker: boolean;
  why: string;
  evidence: string[];
  inputs: { label: string; value: string }[];

  engine: string;
  modelVersion: string;
  freshness: { label: string; stale: boolean };
};

const SPORT_ICON: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  tabletennis: "🏓",
  hockey: "🏒",
  baseball: "⚾",
  handball: "🤾",
  americanfootball: "🏈",
};

const SEL: Record<string, string> = {
  "1": "Home win", X: "Draw", "2": "Away win",
};

function qualityOf(o: {
  hasOdds?: boolean; hasMarket?: boolean; hasModel?: boolean; hasForebet?: boolean;
}): CardModel["quality"] {
  return dataQuality({
    hasOdds: !!o.hasOdds,
    hasMarket: !!o.hasMarket,
    hasModel: !!o.hasModel,
    hasForebet: !!o.hasForebet,
  });
}

function base(o: Partial<CardModel>): CardModel {
  const q = o.quality || qualityOf({});
  return {
    id: o.id || Math.random().toString(36).slice(2),
    sport: o.sport || "football",
    sportIcon: o.sportIcon || SPORT_ICON[o.sport || "football"] || "•",
    league: o.league || "—",
    kickoff: o.kickoff || "",
    status: o.status || "UPCOMING",
    home: o.home || "—",
    away: o.away || "",
    market: o.market || "—",
    selection: o.selection || "—",
    modelProb: o.modelProb ?? null,
    marketProb: o.marketProb ?? null,
    edgePp: o.edgePp ?? null,
    odds: o.odds ?? null,
    ev: o.ev ?? null,
    priced: o.priced ?? false,
    oddsSource: o.oddsSource ?? null,
    value: o.value || "PASS",
    quality: q,
    confidence: o.confidence || confidenceOf(q, o.edgePp ?? null),
    banker: !!o.banker,
    why: o.why || "",
    evidence: o.evidence || [],
    inputs: o.inputs || [],
    engine: o.engine || "—",
    modelVersion: o.modelVersion || "—",
    freshness: o.freshness || { label: "no timestamp", stale: true },
  };
}

/* ------------------------------------------------------------------ */

export function cardFromFootball(p: FbPick): CardModel {
  const modelProb = p.pickProb == null ? null : p.pickProb / 100;
  const marketProb = p.mktImp == null ? null : p.mktImp / 100;
  const odds = p.odds && p.odds > 1 ? p.odds : null;
  const edgePp = p.edge ?? null;
  // An "implied" price is derived from the model percentage, not quoted by a
  // book. It is useful context but must never be treated as a bettable price.
  const oddsSource = !odds ? null : p.oddsSrc === "implied" ? "implied" : "book";
  const priced = !!(odds && marketProb != null && oddsSource === "book");
  const q = qualityOf({
    hasOdds: !!odds,
    hasMarket: marketProb != null,
    hasModel: modelProb != null,
    hasForebet: !!p.fb_pct,
  });

  const inputs: { label: string; value: string }[] = [];
  const m = p.model;
  if (m?.p) inputs.push({ label: "Model 1X2", value: m.p.map((x) => `${x}%`).join(" / ") });
  if (p.fb_pct) inputs.push({ label: "Forebet 1X2", value: p.fb_pct.map((x) => `${x}%`).join(" / ") });
  if (m?.o25) inputs.push({ label: "Over 2.5 goals", value: `${m.o25}%` });
  if (m?.btts) inputs.push({ label: "Both teams to score", value: `${m.btts}%` });
  if (p.ht) inputs.push({ label: "Half-time 1X2", value: p.ht.map((x) => `${x}%`).join(" / ") });
  if (p.ah15) inputs.push({ label: "Asian handicap −1.5", value: `home ${p.ah15.h}% / away ${p.ah15.a}%` });
  if (p.htft) inputs.push({ label: "Half-time / full-time", value: `${p.htft.combo} (${p.htft.p}%)` });
  if (p.fair) inputs.push({ label: "Model fair odds", value: p.fair.filter(Boolean).join(" / ") });

  const evidence: string[] = [];
  if (p.why) evidence.push(p.why);
  if (p.fb_score) evidence.push(`Predicted score ${p.fb_score}`);
  if (p.ou) evidence.push(`Total call ${p.ou}`);
  if (p.oddsSrc === "implied") evidence.push("Odds are model-derived, not a live book price");

  return base({
    id: p.id,
    sport: "football",
    league: p.league,
    kickoff: p.t,
    status: p.result ? "SETTLED" : "UPCOMING",
    home: p.home,
    away: p.away,
    market: "1X2",
    selection: SEL[p.final] || p.final,
    modelProb, marketProb, edgePp, odds,
    ev: evPct(modelProb, odds),
    priced,
    oddsSource,
    value: priced ? classifyValue(edgePp, q.level) : "PASS",
    quality: q,
    banker: p.banker,
    why: p.why,
    evidence,
    inputs,
    engine: p.src === "FOREBET" ? "Forebet" : p.src === "MODEL" ? "OddsOracle model" : "Fusion",
    modelVersion: p.oracle?.model_version || "fusion",
    freshness: oddsFreshness(p.oracle?.oc?.feed_ts || null),
  });
}

export function cardFromBasketball(p: BbPick): CardModel {
  const modelProb = p.pickProb == null ? null : p.pickProb / 100;
  const odds = p.odds && p.odds > 1 ? p.odds : null;
  const q = qualityOf({ hasModel: modelProb != null, hasForebet: !!p.fb_prob, hasOdds: !!odds });
  const inputs: { label: string; value: string }[] = [];
  if (p.fb_prob) inputs.push({ label: "Forebet split", value: p.fb_prob.map((x) => `${x}%`).join(" / ") });
  if (p.fb_score) inputs.push({ label: "Predicted score", value: p.fb_score });
  if (p.fb_avg) inputs.push({ label: "Predicted total", value: `${p.fb_avg}` });
  return base({
    id: p.id, sport: "basketball", league: p.league, kickoff: p.t,
    status: p.result ? "SETTLED" : "UPCOMING",
    home: p.home, away: p.away,
    market: "Moneyline", selection: p.pick || "—",
    modelProb, odds, priced: !!odds,
    value: odds ? classifyValue(null, q.level) : "PASS",
    quality: q, banker: p.banker, why: p.why,
    evidence: [p.why, p.fb_score ? `Predicted ${p.fb_score}` : "", `Confidence: ${p.conf}`].filter(Boolean),
    inputs,
    engine: "Forebet", modelVersion: "forebet",
    freshness: { label: "no book timestamp", stale: true },
  });
}

export function cardFromTennis(p: TnPick): CardModel {
  const modelProb = p.pickProb == null ? null : p.pickProb / 100;
  const odds = p.odds && p.odds > 1 ? p.odds : null;
  const q = qualityOf({ hasModel: modelProb != null, hasForebet: !!p.prob, hasOdds: !!odds });
  const inputs: { label: string; value: string }[] = [];
  if (p.prob) inputs.push({ label: "Forebet split", value: p.prob.map((x) => `${x}%`).join(" / ") });
  if (p.sets) inputs.push({ label: "Predicted sets", value: p.sets });
  return base({
    id: p.id, sport: "tennis", league: p.tourn || "Tennis", kickoff: p.t,
    status: p.result ? "SETTLED" : "UPCOMING",
    home: p.p1 || "", away: p.p2 || "",
    market: "Match winner", selection: p.pred || "—",
    modelProb, odds, priced: !!odds,
    value: odds ? classifyValue(null, q.level) : "PASS",
    quality: q, banker: p.banker, why: p.why,
    evidence: [p.why, p.sets ? `Predicted sets ${p.sets}` : ""].filter(Boolean),
    inputs,
    engine: "Forebet", modelVersion: "forebet",
    freshness: { label: "no book timestamp", stale: true },
  });
}

/** Hockey / baseball / handball / NCAA / table tennis boards — all probability-only. */
export function cardFromSimple(
  g: any,
  sport: string,
  opt?: { market?: string; modelProb?: number | null; extra?: { label: string; value: string }[] }
): CardModel {
  const probs = Array.isArray(g.prob)
    ? g.prob
    : typeof g.prob === "string" && g.prob.includes("/")
      ? g.prob.split("/").map(Number)
      : null;
  const pickIdx = String(g.pred || g.pick || "1").match(/2/) ? (probs && probs.length > 2 ? 2 : 1) : 0;
  const modelProb = opt?.modelProb != null
    ? opt.modelProb
    : probs && probs.length
      ? (() => { const t = probs.reduce((a: number, b: number) => a + b, 0); return t ? probs[pickIdx] / t : null; })()
      : null;
  const home = g.home || g.p1 || (String(g.match || "").split(" v ")[0] ?? "");
  const away = g.away || g.p2 || (String(g.match || "").split(" v ")[1] ?? "");
  const finished = /^(f|ft|aet|pen)/i.test(String(g.status || "")) || !!g.final;
  const q = qualityOf({ hasModel: modelProb != null, hasForebet: !!probs });
  const inputs = [...(opt?.extra || [])];
  if (probs) inputs.unshift({ label: "Forebet split", value: probs.map((x: number) => `${Math.round(x)}%`).join(" / ") });
  if (g.score) inputs.push({ label: "Predicted score", value: String(g.score) });
  if (g.avg) inputs.push({ label: "Predicted total", value: String(g.avg) });

  return base({
    id: String(g.match_id || `${sport}-${home}-${away}-${g.t || ""}`),
    sport, league: g.league || g.tournament || "—", kickoff: g.t || g.time_wat || "",
    status: finished ? "SETTLED" : "UPCOMING",
    home, away,
    market: opt?.market || "Match winner",
    selection: String(g.pred || g.pick || "1"),
    modelProb,
    priced: false,
    value: "PASS",
    quality: q,
    evidence: [g.why, g.score ? `Predicted ${g.score}` : ""].filter(Boolean),
    inputs,
    engine: "Forebet / Setka model",
    modelVersion: "—",
    freshness: { label: "no book timestamp", stale: true },
  });
}
