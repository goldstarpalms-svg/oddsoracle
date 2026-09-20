"use client";

import { useEffect, useState, type ReactNode } from "react";
import { matchState, SPORT_DUR } from "@/lib/matchClock";

interface Props {
  t?: string | null; // "HH:MM" or "D/M HH:MM" (WAT wall-clock)
  iso?: string | null; // ISO start (MLB feed)
  dataDate?: string | null; // board date YYYY-MM-DD
  sport?: string; // for duration lookup
  durMin?: number; // override
  final?: string | null; // final score if known (build-time stamp / FT row)
  icon?: string;
  children: ReactNode;
}

/**
 * Auto life-cycle for a match card. While the game is upcoming or live it
 * renders the normal card. The moment it ends (kickoff + duration) the card
 * is either UPDATED with the final score (when we know it) or REMOVED —
 * no stale, unbettable cards sit on the board. Re-checks every 30s.
 */
export default function GameGate({ t, iso, dataDate, sport, durMin, final, icon, children }: Props) {
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!now || (!t && !iso)) return <>{children}</>;
  const dur = durMin ?? SPORT_DUR[sport || "football"] ?? 170;
  const st = matchState(t, now, dur, dataDate, iso);
  if (st !== "done") return <>{children}</>;

  if (final) {
    return (
      <div className="game-final" role="status">
        <span className="game-final-tag">🏁 FINAL</span>
        <span className="game-final-score">
          {icon} {final}
        </span>
        <span className="game-final-t">{String(t || "").split(" ").pop()} WAT</span>
      </div>
    );
  }
  return null; // finished and we don't have the score → remove it
}
