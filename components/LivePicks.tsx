"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Prediction {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  tip: string;
  confidence: string;
  odds: string;
  analysis: string;
}

interface Result {
  source: "local" | "live" | "fallback";
  updatedAt: string;
  predictions: Prediction[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function LivePicks({ count = 4 }: { count?: number }) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/predictions/", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      const json = (await res.json()) as Result;
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="hero-card">
        <div className="hero-card-head">
          <span className="live"><span className="dot" /> LIVE NOW</span>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Loading…</span>
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="mini-row" key={i}>
            <div>
              <div className="mini-meta" style={{ color: "var(--text-faint)" }}>——</div>
              <div className="mini-teams" style={{ color: "var(--text-faint)" }}>Loading fixture…</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const picks = (data?.predictions || []).slice(0, count);

  return (
    <div className="hero-card">
      <div className="hero-card-head">
        <span className="live"><span className="dot" /> LIVE NOW</span>
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
          {data?.source === "local" ? "Real-data feed (Forebet + model)" : data?.source === "live" ? "Live market data" : "Editorial picks"} ·{" "}
          {data ? timeAgo(data.updatedAt) : "offline"}
        </span>
      </div>

      {error ? (
        <div className="mini-row">
          <div className="mini-tip" style={{ color: "var(--text-faint)" }}>
            Live feed unavailable right now.
          </div>
        </div>
      ) : (
        picks.map((p) => (
          <div className="mini-row" key={p.id}>
            <div>
              <div className="mini-meta">{p.league}</div>
              <div className="mini-teams">
                {p.home} <span style={{ color: "var(--text-faint)" }}>v</span> {p.away}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 3 }}>
                {p.kickoff}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mini-tip">
                {p.market}: <span style={{ color: "#7cf5b5", fontWeight: 700 }}>{p.tip}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                @{p.odds} · {p.confidence}
              </div>
            </div>
          </div>
        ))
      )}

      <Link href="/predictions/" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
        See all picks
      </Link>
    </div>
  );
}
