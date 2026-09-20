"use client";

/** SaferStake-style safety tag from a model probability (shared by cards + boards). */
export function mktTagLike(p: number | null) {
  if (p == null) return null;
  if (p >= 70) return <span className="mkt-tag mkt-safe">🟢 SAFE</span>;
  if (p >= 55) return <span className="mkt-tag mkt-steady">🟡 STEADY</span>;
  return <span className="mkt-tag mkt-risky">🔴 RISKY</span>;
}
