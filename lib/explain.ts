import type { BoardEvent } from "./board";

/**
 * The explanation shown in the detail panel — built only from numbers the
 * backend actually produced. Type-only import keeps the 650 KB data snapshot
 * out of the client bundle (the board page computes this server-side if needed).
 */
export function explain(e: BoardEvent): string {
  const bits: string[] = [];

  if (e.edgePp != null && e.modelProb != null && e.marketProb != null) {
    const dir = e.edgePp >= 0 ? "above" : "below";
    bits.push(
      `Model probability is ${Math.abs(e.edgePp).toFixed(1)}pp ${dir} the market-implied ` +
        `probability (${Math.round(e.modelProb * 100)}% vs ${Math.round(e.marketProb * 100)}%).`
    );
  } else {
    bits.push("No market price is available for this selection, so no edge can be computed.");
  }

  const drivers = e.evidence.slice(0, 3).map((s) => s.replace(/^(For:|Against:)\s*/, ""));
  if (drivers.length) bits.push(`Driven by: ${drivers.join("; ")}.`);
  if (e.quality.level === "Low")
    bits.push("Data coverage is thin — treat this estimate as indicative.");
  if (e.engines.length > 1) {
    const probs = e.engines.map((g) => g.prob).filter((p): p is number => p != null);
    if (probs.length > 1) {
      const spread = Math.max(...probs) - Math.min(...probs);
      if (spread > 0.08)
        bits.push(`The two engines differ by ${Math.round(spread * 100)}pp on this event.`);
    }
  }

  if (bits.length <= 1 && !drivers.length)
    return "Insufficient evidence for a detailed explanation.";
  return bits.join(" ");
}
