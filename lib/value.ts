/**
 * Shared value / probability mathematics — the single source of truth.
 *
 * Rule: no component may re-implement edge, EV, de-vigging or value
 * classification. Everything comes from here so the numbers on the page and
 * the numbers in the API can never drift apart. Thresholds are data, not
 * constants sprinkled through the UI.
 */

export type ValueClass = "STRONG VALUE" | "VALUE" | "FAIR" | "PASS";
export type DataQuality = "High" | "Medium" | "Low";
export type PredictionStatus =
  | "UPCOMING" | "LIVE" | "SETTLED" | "VOID" | "CANCELLED" | "STALE";

/** Configurable thresholds (percentage points of model-vs-market edge). */
export const THRESHOLDS = {
  /** below this: no meaningful discrepancy */
  fairMinPp: 2,
  /** at/above this: meaningful positive discrepancy */
  valueMinPp: 5,
  /** at/above this AND adequate data quality: strong value */
  strongValueMinPp: 10,
  /** minimum sample/quality for a STRONG VALUE label */
  strongValueMinQuality: "Medium" as DataQuality,
  /** an edge more negative than this is an explicit PASS even at high probability */
  passBelowPp: -2,
  /** odds older than this (minutes) are displayed as STALE */
  staleOddsMinutes: 45,
  /** snapshot older than this (hours) is STALE */
  staleSnapshotHours: 36,
} as const;

/* ------------------------------------------------------------------ */
/* Odds maths                                                          */
/* ------------------------------------------------------------------ */

/** Implied probability from a single decimal price: 1 / odds. */
export function implied(odds: number | null | undefined): number | null {
  if (!odds || !Number.isFinite(odds) || odds <= 1) return null;
  return 1 / odds;
}

/**
 * Strip the overround from a set of prices so the probabilities sum to 1.
 * Returns null if the prices are unusable.
 */
export function devig(odds: number[]): number[] | null {
  const clean = odds.filter((o) => Number.isFinite(o) && o > 1);
  if (clean.length < 2) return null;
  const raw = clean.map((o) => 1 / o);
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  return raw.map((p) => p / sum);
}

/** Overround (book margin) as a fraction — 0.05 means a 5% book edge. */
export function overround(odds: number[]): number | null {
  const clean = odds.filter((o) => Number.isFinite(o) && o > 1);
  if (clean.length < 2) return null;
  const sum = clean.reduce((a, o) => a + 1 / o, 0);
  return sum > 0 ? sum - 1 : null;
}

/** Edge in percentage points: (model − market) × 100. Never a percentage. */
export function edgePP(
  modelProb: number | null | undefined,
  marketProb: number | null | undefined
): number | null {
  if (modelProb == null || marketProb == null) return null;
  if (!Number.isFinite(modelProb) || !Number.isFinite(marketProb)) return null;
  return (modelProb - marketProb) * 100;
}

/** Expected value for a decimal price: model × odds − 1. */
export function evPct(
  modelProb: number | null | undefined,
  odds: number | null | undefined
): number | null {
  if (modelProb == null || !odds || !Number.isFinite(odds) || odds <= 1) return null;
  if (!Number.isFinite(modelProb)) return null;
  return modelProb * odds - 1;
}

/** Model → decimal "fair" price. */
export function fairOdds(modelProb: number | null | undefined): number | null {
  if (!modelProb || !Number.isFinite(modelProb) || modelProb <= 0 || modelProb >= 1) return null;
  return 1 / modelProb;
}

/* ------------------------------------------------------------------ */
/* Classification                                                      */
/* ------------------------------------------------------------------ */

/**
 * Objective value classification. Data quality gates the top label: a huge
 * edge on a thin sample is VALUE, not STRONG VALUE.
 */
export function classifyValue(
  edgePp: number | null,
  quality: DataQuality = "Medium"
): ValueClass {
  if (edgePp == null || !Number.isFinite(edgePp)) return "PASS";
  if (edgePp < THRESHOLDS.fairMinPp) return edgePp < THRESHOLDS.passBelowPp ? "PASS" : "FAIR";
  if (edgePp >= THRESHOLDS.strongValueMinPp) {
    const rank: Record<DataQuality, number> = { Low: 0, Medium: 1, High: 2 };
    if (rank[quality] >= rank[THRESHOLDS.strongValueMinQuality]) return "STRONG VALUE";
  }
  return edgePp >= THRESHOLDS.valueMinPp ? "VALUE" : "FAIR";
}

export function valueTone(v: ValueClass): "positive" | "warning" | "neutral" {
  if (v === "STRONG VALUE" || v === "VALUE") return "positive";
  if (v === "FAIR") return "warning";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Data quality                                                        */
/* ------------------------------------------------------------------ */

export type QualityInput = {
  hasOdds?: boolean;
  hasMarket?: boolean;
  hasModel?: boolean;
  hasForebet?: boolean;
  books?: number | null;
  sampleMatches?: number | null;
  oddsAgeMinutes?: number | null;
  lineupKnown?: boolean;
};

export type QualityResult = {
  level: DataQuality;
  score: number;          // 0–100
  reasons: string[];      // shown to the user in the detail panel
};

/**
 * Data quality is deliberately conservative: a pick must earn the right to
 * look as reliable as one backed by full market + model coverage.
 */
export function dataQuality(i: QualityInput): QualityResult {
  let score = 0;
  const reasons: string[] = [];

  if (i.hasModel) { score += 34; reasons.push("model probability available"); }
  else reasons.push("no model probability for this fixture");

  if (i.hasOdds) { score += 26; reasons.push("book price available"); }
  else reasons.push("no book price — no EV can be computed");

  if (i.hasMarket) { score += 16; reasons.push("market prices available for de-vigging"); }
  else reasons.push("no market prices — cannot de-vig");

  const books = i.books ?? 0;
  if (books >= 10) { score += 12; reasons.push(`${books} bookmakers compared`); }
  else if (books >= 3) { score += 7; reasons.push(`${books} bookmakers compared`); }
  else if (books > 0) reasons.push("single bookmaker — prices not cross-checked");

  const n = i.sampleMatches ?? 0;
  if (n >= 60) { score += 12; reasons.push(`trained on ${n} historical matches`); }
  else if (n >= 20) { score += 7; reasons.push(`only ${n} historical matches`); }
  else if (n > 0) reasons.push(`thin history: ${n} matches`);
  else reasons.push("no historical sample for these teams");

  if (i.lineupKnown) score += 0; // reserved — we do not claim lineup data today

  const age = i.oddsAgeMinutes;
  if (age != null) {
    if (age <= THRESHOLDS.staleOddsMinutes) score += 0;
    else reasons.push(`prices are ${Math.round(age)} minutes old`);
  }

  score = Math.max(0, Math.min(100, score));
  const level: DataQuality = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
  return { level, score, reasons };
}

/* ------------------------------------------------------------------ */
/* Freshness                                                           */
/* ------------------------------------------------------------------ */

export function oddsFreshness(
  iso: string | null | undefined,
  now: number = Date.now()
): { minutes: number | null; stale: boolean; label: string } {
  if (!iso) return { minutes: null, stale: true, label: "no timestamp" };
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { minutes: null, stale: true, label: "bad timestamp" };
  const mins = Math.max(0, Math.round((now - t) / 60000));
  const stale = mins > THRESHOLDS.staleOddsMinutes;
  let label: string;
  if (mins < 1) label = "updated just now";
  else if (mins < 60) label = `updated ${mins}m ago`;
  else if (mins < 1440) label = `updated ${Math.round(mins / 60)}h ago`;
  else label = `updated ${Math.round(mins / 1440)}d ago`;
  return { minutes: mins, stale, label };
}

/* ------------------------------------------------------------------ */
/* Formatting (keeps every number on the site consistent)              */
/* ------------------------------------------------------------------ */

export const fmtPct = (p: number | null | undefined, dp = 0): string =>
  p == null || !Number.isFinite(p) ? "—" : `${(p * 100).toFixed(dp)}%`;

export const fmtPp = (pp: number | null | undefined, dp = 1): string =>
  pp == null || !Number.isFinite(pp) ? "—" : `${pp >= 0 ? "+" : ""}${pp.toFixed(dp)}pp`;

export const fmtOdds = (o: number | null | undefined): string =>
  o == null || !Number.isFinite(o) || o <= 1 ? "—" : o.toFixed(2);

export const fmtEv = (e: number | null | undefined, dp = 1): string =>
  e == null || !Number.isFinite(e) ? "—" : `${e >= 0 ? "+" : ""}${(e * 100).toFixed(dp)}%`;

/**
 * Confidence ≠ probability. Confidence describes how much we trust the
 * estimate (sample size, market coverage, agreement between sources) and is
 * deliberately coarse. Never render a probability with the word "confidence".
 */
export function confidenceOf(q: QualityResult, disagreementPp: number | null): {
  level: "High" | "Medium" | "Low";
  note: string;
} {
  if (q.level === "High" && (disagreementPp == null || Math.abs(disagreementPp) <= 8))
    return { level: "High", note: "Full model + market coverage, sources broadly agree." };
  if (q.level === "Low")
    return { level: "Low", note: "Thin data — treat the estimate as indicative only." };
  return {
    level: "Medium",
    note:
      disagreementPp != null && Math.abs(disagreementPp) > 12
        ? "Model and market disagree materially — estimate is less stable."
        : "Partial coverage — estimate is usable but not fully cross-checked.",
  };
}
