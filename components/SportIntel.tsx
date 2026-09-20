/**
 * SportIntel — per-sport "what the model can see / cannot see" panel.
 * 4.0 rule: unknown inputs are shown as UNAVAILABLE, never invented.
 */

const INTEL: Record<string, { has: string[]; missing: string[] }> = {
  football: {
    has: [
      "Forebet probabilities + predicted scores (90+ games daily)",
      "Bookmaker prices from 350+ books, re-fetched live (OddsChecker)",
      "Poisson model + 10,000-match Monte Carlo (season stats, home advantage, form)",
      "Head-to-head + season stats per league",
    ],
    missing: ["confirmed lineups", "official injury reports", "xG feeds"],
  },
  basketball: {
    has: [
      "Forebet moneyline split + predicted final scores and totals",
      "League context for every game listed",
    ],
    missing: [
      "team ratings (elo-style) — unavailable",
      "pace & efficiency numbers — unavailable",
      "rest days / back-to-back flags — unavailable",
      "availability / injury reports — unavailable (no licensed feed)",
    ],
  },
  tennis: {
    has: [
      "Forebet match-winner probabilities + predicted set scores",
      "Full probability split on every match",
    ],
    missing: [
      "surface-specific serve/return numbers — unavailable",
      "breakpoint statistics — unavailable",
      "official form tables — unavailable (no licensed feed)",
    ],
  },
  other: {
    has: [
      "Bookmaker odds (MLB with 350+ book prices; NCAAF/NFL/NHL boards)",
      "Forebet picks where the board exists (NCAAF, NFL from 25 Sep)",
    ],
    missing: [
      "roster/availability data — unavailable",
      "in-game live model for most US sports — pre-match only",
    ],
  },
};

export default function SportIntel({ sport }: { sport: string }) {
  const d = INTEL[sport];
  if (!d) return null;
  return (
    <div className="intel-panel">
      <div className="intel-col">
        <h4>✓ What the model can see</h4>
        <ul>
          {d.has.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
      <div className="intel-col intel-missing">
        <h4>✗ Unavailable (we say so instead of guessing)</h4>
        <ul>
          {d.missing.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
