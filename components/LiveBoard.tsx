"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StateBlock, Skeleton, stateFrom } from "@/components/ui/StateBlock";
import { ValueBadge } from "@/components/ui/Badge";
import { classifyValue, fmtOdds, oddsFreshness } from "@/lib/value";

interface LivePick {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  tip: string;
  odds?: string;
}

interface Feed {
  source: "local" | "live" | "fallback";
  updatedAt: string;
  predictions: LivePick[];
}

/**
 * Live region with real states. It never renders "Loading…" as content and it
 * never invents fixtures to avoid showing an empty state.
 */
export default function LiveBoard({ count = 5 }: { count?: number }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/predictions/", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setFeed((await res.json()) as Feed);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const age = oddsFreshness(feed?.updatedAt || null);
  const state = stateFrom({
    loading,
    error,
    data: feed?.predictions,
    stale: age.stale,
  });

  return (
    <div className="ds-panel" style={{ padding: "var(--s-4)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: "var(--s-4)",
        }}
      >
        <span className="ds-eyebrow">
          {!loading && !error && age.stale ? "Latest available" : "Today’s board"}
        </span>
        <span className="ds-meta">
          {feed ? `${age.label}` : loading ? "connecting…" : "offline"}
        </span>
      </div>

      <StateBlock
        state={state}
        emptyMessage="No events available on the board right now. Nothing is shown rather than filling the space with placeholder fixtures."
        staleMessage={`Live data delayed — ${age.label}. Showing the most recent board we have.`}
        onRetry={load}
      >
        <div style={{ display: "grid", gap: 10 }}>
          {(feed?.predictions || []).slice(0, count).map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 10,
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="ds-meta">
                  {p.league} · {p.kickoff}
                </div>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "var(--t-body)" }}>
                  {p.home} <span style={{ color: "var(--text-3)" }}>v</span> {p.away}
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: "var(--t-sm)" }}>
                  {p.market}: {p.tip}
                </div>
                <div className="ds-meta num">@{fmtOdds(Number(p.odds))}</div>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/board/"
          className="ds-btn ds-btn-sm"
          style={{ width: "100%", marginTop: "var(--s-4)" }}
        >
          Open the full board
        </Link>
      </StateBlock>
    </div>
  );
}
