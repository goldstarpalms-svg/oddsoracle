"use client";

import { useMemo } from "react";
import SNAPSHOT from "@/lib/data-snapshot.json";

interface G {
  match: string;
  home: string;
  away: string;
  t: string;
  prob: string; // "66/34"
  pred: string; // "1" or "2"
  score: string;
}

export default function NcaaFbBoard() {
  const games = useMemo<G[]>(() => {
    const list: G[] = (SNAPSHOT as any).ncaafb?.games || [];
    return [...list].sort((a, b) => a.t.localeCompare(b.t));
  }, []);

  if (!games.length) return null;

  const banker = (g: G) => {
    const [p1, p2] = g.prob.split("/").map(Number);
    return Math.max(p1, p2) >= 80;
  };

  return (
    <div style={{ marginTop: 26 }}>
      <div className="callout callout-blue">
        🏈 <b>NCAA American football is live on this board</b> — {games.length} games with
        Forebet&rsquo;s 1/2 split, pick and predicted score. 💪 = 80%+ favourite. Times in WAT.
      </div>
      <div className="odds-list" style={{ marginTop: 14 }}>
        {games.map((g, i) => {
          const [p1, p2] = g.prob.split("/").map(Number);
          const favHome = g.pred === "1";
          const favPct = favHome ? p1 : p2;
          return (
            <div key={i} className="odds-card">
              <div className="odds-card-head" style={{ cursor: "default" }}>
                <span className="odds-card-match">
                  {g.home} <em>vs</em> {g.away}
                  {banker(g) && <span className="badge badge-banker" style={{ marginLeft: 8 }}>💪</span>}
                </span>
                <span className="odds-card-time">{g.t} WAT</span>
              </div>
              <div className="odds-card-best">
                <div className="odds-best-col">
                  <span>{g.home}</span>
                  {favHome ? <b className="odds-hot">💰 {p1}%</b> : <b>{p1}%</b>}
                </div>
                <div className="odds-best-col">
                  <span>Pick {g.pred === "1" ? g.home : g.away}</span>
                  <b>{g.pred === "1" ? "1 (Home)" : "2 (Away)"} · {favPct}%</b>
                </div>
                <div className="odds-best-col">
                  <span>{g.away}</span>
                  {!favHome ? <b className="odds-hot">💰 {p2}%</b> : <b>{p2}%</b>}
                </div>
              </div>
              <p className="slip-note dim" style={{ padding: "0 12px 10px" }}>
                Forebet score: {g.score}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
