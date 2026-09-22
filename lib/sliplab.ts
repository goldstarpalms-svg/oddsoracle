/**
 * Slip Lab mathematics.
 *
 * A multi-leg slip is where most people lose their money, because multiplying
 * probabilities as if every leg were independent flatters the ticket badly.
 * This module does the arithmetic honestly and says out loud where it can't be
 * trusted:
 *
 *   - legs from the SAME match are correlated, never independent
 *   - two legs in the same league/kickoff window may be correlated
 *   - the combined figure is an approximation and is labelled as one
 *
 * No model, no data feed, no API key needed. This works with whatever you type.
 */

export type SlipLeg = {
  id: string;
  event: string;          // "Arsenal v Chelsea"
  market: string;         // "1X2", "Over 2.5", ...
  selection: string;      // "Draw", "Over 2.5", ...
  odds: number;           // decimal
  modelProb?: number | null; // 0–1, when we have one
  league?: string;
  kickoff?: string;
};

export type SlipAnalysis = {
  legs: number;
  combinedOdds: number | null;
  /** product of leg probabilities — assumes independence */
  combinedProb: number | null;
  /** range when legs are correlated (conservative lower bound) */
  combinedProbLow: number | null;
  fairOdds: number | null;
  /** how much of the combined price is bookmaker margin */
  marginPct: number | null;
  weakestLeg: SlipLeg | null;
  strongestLeg: SlipLeg | null;
  correlated: { a: string; b: string; reason: string }[];
  risk: "LOWER MODEL RISK" | "HIGHER MODEL RISK" | "UNKNOWN";
  riskNote: string;
  /** quarter Kelly on the combined number, capped */
  stakePct: number | null;
  stakeNgn: number | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function analyseSlip(legs: SlipLeg[], bankrollNgn = 100_000): SlipAnalysis {
  const priced = legs.filter((l) => l.odds > 1);
  if (priced.length === 0) {
    return {
      legs: legs.length, combinedOdds: null, combinedProb: null, combinedProbLow: null,
      fairOdds: null, marginPct: null, weakestLeg: null, strongestLeg: null,
      correlated: [], risk: "UNKNOWN",
      riskNote: "Add at least one leg with a price to see the maths.",
      stakePct: null, stakeNgn: null,
    };
  }

  const combinedOdds = priced.reduce((acc, l) => acc * l.odds, 1);

  const withProb = legs.filter((l) => l.modelProb && l.modelProb > 0 && l.modelProb < 1);
  const combinedProb = withProb.length === legs.length && withProb.length > 0
    ? withProb.reduce((acc, l) => acc * (l.modelProb as number), 1)
    : null;

  // Correlated legs: same event, or same league and same kickoff window.
  const correlated: { a: string; b: string; reason: string }[] = [];
  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const a = legs[i], b = legs[j];
      if (norm(a.event) && norm(a.event) === norm(b.event)) {
        correlated.push({ a: a.selection, b: b.selection, reason: "same match — outcomes are correlated" });
      } else if (a.league && a.league === b.league && a.kickoff && a.kickoff === b.kickoff) {
        correlated.push({ a: a.selection, b: b.selection, reason: "same league and kickoff" });
      }
    }
  }

  // Conservative floor: when legs are correlated, the joint probability is
  // bounded below by 1 - sum(1 - p) (Fréchet), never by the product.
  let combinedProbLow: number | null = null;
  if (withProb.length === legs.length && withProb.length > 0) {
    const sumMiss = withProb.reduce((acc, l) => acc + (1 - (l.modelProb as number)), 0);
    combinedProbLow = Math.max(0, 1 - sumMiss);
  }

  const fairOdds = combinedProb && combinedProb > 0 ? 1 / combinedProb : null;
  const marginPct = fairOdds && combinedOdds > 0 ? (1 - fairOdds / combinedOdds) * 100 : null;

  const sorted = [...withProb].sort((a, b) => (a.modelProb ?? 1) - (b.modelProb ?? 1));
  const weakestLeg = sorted[0] ?? null;
  const strongestLeg = sorted[sorted.length - 1] ?? null;

  // Risk verdict uses neutral language — never "safe".
  let risk: SlipAnalysis["risk"] = "UNKNOWN";
  let riskNote = "We can only judge risk on legs we have a model probability for.";
  if (combinedProb != null) {
    const edge = fairOdds ? combinedOdds / fairOdds - 1 : 0;
    if (combinedProb >= 0.4 && edge > 0) {
      risk = "LOWER MODEL RISK";
      riskNote = "The combined price is above what our numbers say the slip is worth.";
    } else {
      risk = "HIGHER MODEL RISK";
      riskNote =
        combinedProb < 0.25
          ? "Fewer than one in four of these slips land. Every extra leg multiplies that."
          : "The combined price does not compensate for the combined chance of it landing.";
    }
  }
  if (correlated.length > 0) {
    riskNote += " Two legs on this slip are correlated, so the true chance is below the multiplied figure.";
  }

  // Quarter Kelly on the combined number, capped hard at 2% for accumulators.
  let stakePct: number | null = null;
  if (combinedProb && combinedOdds > 1) {
    const b = combinedOdds - 1;
    const full = (combinedProb * b - (1 - combinedProb)) / b;
    stakePct = full > 0 ? Math.min(full * 0.25, 0.02) : 0;
  }

  return {
    legs: legs.length,
    combinedOdds,
    combinedProb,
    combinedProbLow,
    fairOdds,
    marginPct,
    weakestLeg,
    strongestLeg,
    correlated,
    risk,
    riskNote,
    stakePct,
    stakeNgn: stakePct != null ? Math.round(stakePct * bankrollNgn) : null,
  };
}

/** Slips travel in the URL so a shared slip needs no database. */
export function encodeSlip(legs: SlipLeg[]): string {
  const slim = legs.map((l) => [l.event, l.market, l.selection, l.odds, l.modelProb ?? "", l.league ?? "", l.kickoff ?? ""]);
  return encodeURIComponent(JSON.stringify(slim));
}

export function decodeSlip(raw: string | null): SlipLeg[] {
  if (!raw) return [];
  try {
    const slim = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(slim)) return [];
    return slim.map((a: any[], i: number) => ({
      id: `shared-${i}`,
      event: String(a[0] || ""),
      market: String(a[1] || ""),
      selection: String(a[2] || ""),
      odds: Number(a[3]) || 0,
      modelProb: a[4] === "" || a[4] == null ? null : Number(a[4]),
      league: a[5] ? String(a[5]) : undefined,
      kickoff: a[6] ? String(a[6]) : undefined,
    })).filter((l) => l.event && l.odds > 1);
  } catch {
    return [];
  }
}

/**
 * Correlation warning copy. The rule from the spec: never multiply blindly,
 * and where correlation cannot be modelled, say the figure is approximate.
 */
export function independenceCaveat(a: SlipAnalysis): string {
  if (a.combinedProb == null) {
    return "We only have model probabilities for some legs, so no combined chance is shown — we will not invent one.";
  }
  if (a.correlated.length > 0) {
    return "Combined probability is an approximation and assumes independence. This slip contains correlated legs, so the true chance is lower than the figure shown.";
  }
  return "Combined probability is an approximation and assumes independence between legs. Real slips are rarely perfectly independent.";
}
