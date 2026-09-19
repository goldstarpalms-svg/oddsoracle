"use client";

import { useMemo, useState } from "react";
import SNAPSHOT from "@/lib/data-snapshot.json";

interface Leg {
  sport: string;
  game: string;
  t: string;
  market: string;
  side: string;
  prob: number;
  odds: number;
  book: string;
}

export default function SafeCombos() {
  const safe = useMemo(() => (SNAPSHOT as any).safe as
    | {
        dataDate: string;
        s20: { legs: Leg[]; totalOdds: number; allHitProb: number };
        s10: { legs: Leg[]; totalOdds: number; allHitProb: number };
        s5: { legs: Leg[]; totalOdds: number; allHitProb: number };
      }
    | null, []);
  const [copied, setCopied] = useState<string | null>(null);

  if (!safe) return null;

  const copy = async (key: string, n: number, legs: Leg[]) => {
    const lines = legs.map((l, i) => `${i + 1}. ${l.game} — ${l.market}: ${l.side} @${l.odds} (${l.prob}%)`);
    const text = [
      `ODDSORACLE SAFE ${n} — ${safe.dataDate}`,
      ...lines,
      ``,
      `Total odds: @${legs.reduce((a, l) => a * l.odds, 1).toFixed(2)}`,
      `Model chance all ${legs.length} hit: ~${(legs.reduce((a, l) => a * (l.prob / 100), 1) * 100).toFixed(1)}%`,
      `Every leg is rated 80%+ individually. Stake 1 unit max. 18+`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const card = (key: string, n: number, data: { legs: Leg[]; totalOdds: number; allHitProb: number }, note: string) => (
    <div className="combo-box" style={{ flex: "1 1 300px", minWidth: 280 }}>
      <div className="combo-head">
        <span className="combo-title">🛡️ Safe {n}</span>
        <span className="combo-total">
          @{data.totalOdds.toFixed(2)} · <small>~{data.allHitProb}% to land all</small>
        </span>
      </div>
      <div className="combo-legs" style={{ maxHeight: 320, overflowY: "auto" }}>
        {data.legs.map((l, i) => (
          <div className="combo-leg" key={i}>
            <span className="combo-leg-n">{i + 1}</span>
            <span className="combo-leg-match">
              {l.sport} {l.game}
            </span>
            <span className="combo-leg-pick">
              {l.market}: {l.side}
            </span>
            <span className="combo-leg-odds">@{l.odds.toFixed(2)}</span>
            <span className="combo-leg-prob">{l.prob}%</span>
          </div>
        ))}
      </div>
      <div className="combo-foot" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary btn-sm" onClick={() => copy(key, n, data.legs)}>
          {copied === key ? "✓ Copied" : `Copy Safe ${n}`}
        </button>
        <span className="slip-note" style={{ margin: 0 }}>{note}</span>
      </div>
    </div>
  );

  return (
    <section className="sec">
      <div className="container">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          {card("s5", 5, safe.s5, "Short and sweet — the 5 safest legs on the board. Best shot of the three.")}
          {card("s10", 10, safe.s10, "The balanced play — 10 legs at 80%+, about a 1-in-4 chance.")}
          {card("s20", 20, safe.s20, "The full 20 — maximum odds, minimum chance. Fun money only.")}
        </div>
        <p className="slip-note" style={{ marginTop: 12 }}>
          Every leg is a pick our model (or Forebet) rates at <b>80% or better</b> individually —
          over 1.5 goals, double chance, draw no bet and heavy favourites. When you add legs, the
          combined chance drops fast (that&rsquo;s maths, not doubt) — so stake each combo 1 unit
          max, and take the one you&rsquo;re most comfortable with. Rebuilt automatically every day.
        </p>
      </div>
    </section>
  );
}
