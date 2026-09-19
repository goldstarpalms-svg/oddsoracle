"use client";

import { fbPicks, bbPicks, tnPicks } from "@/lib/rich";

interface Row {
  id: string;
  sport: string;
  home: string;
  away: string;
  pick: string;
  odds: number | null;
  prob: number;
  bank: boolean;
}

/** "Always on" best-picks board: the top calls of the day across all sports,
 *  ranked by model chance — the one strip you should read first. */
export default function BestPicks({ limit = 6 }: { limit?: number }) {
  const fb = fbPicks();
  const bb = bbPicks();
  const tn = tnPicks();

  const all: Row[] = [
    ...fb.map((p) => ({
      id: p.id,
      sport: "⚽",
      home: p.home,
      away: p.away,
      pick: p.final,
      odds: p.odds,
      prob: p.pickProb ?? 0,
      bank: p.banker || p.model?.bank === "BANKER",
    })),
    ...bb.map((p) => ({
      id: p.id,
      sport: "🏀",
      home: p.home,
      away: p.away,
      pick: p.pick,
      odds: p.odds,
      prob: p.pickProb ?? 0,
      bank: p.banker,
    })),
    ...tn.map((p) => ({
      id: p.id,
      sport: "🎾",
      home: p.p1,
      away: p.p2,
      pick: /^1/.test(p.pred) ? p.p1 : p.p2,
      odds: p.odds,
      prob: p.pickProb ?? 0,
      bank: p.banker,
    })),
  ]
    .filter((x) => x.prob >= 55)
    .sort((a, b) => b.prob - a.prob)
    .slice(0, limit);

  if (all.length === 0) return null;

  return (
    <div className="bestpicks">
      <div className="bestpicks-head">
        <span className="bestpicks-title">🏆 Today&rsquo;s best picks</span>
        <span className="bestpicks-sub">ranked by chance of winning · rebuilt every morning</span>
      </div>
      <div className="bestpicks-list">
        {all.map((x, i) => (
          <div key={x.id} className={`bestpick ${x.prob >= 70 ? "bp-safe" : ""}`}>
            <span className="bp-rank">{i + 1}</span>
            <span className="bp-match">
              {x.sport} {x.home} <em>vs</em> {x.away}
            </span>
            <span className="bp-pick">
              {x.pick}
              {x.bank && <span className="badge badge-banker" style={{ padding: "1px 6px", fontSize: 9 }}>🏦</span>}
            </span>
            <span className="bp-odds">@{x.odds ? x.odds.toFixed(2) : "—"}</span>
            <span className={`bp-prob ${x.prob >= 70 ? "hi" : ""}`}>{x.prob}%</span>
          </div>
        ))}
      </div>
      <p className="bp-note">
        70%+ means 7 out of 10. The house rule stays the same as the pros: 1 unit max on any
        pick, never chase a loss.
      </p>
    </div>
  );
}
