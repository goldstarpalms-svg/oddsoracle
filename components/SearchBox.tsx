"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Row {
  id: string;
  sport: string;
  league: string;
  a: string;
  b: string;
  t: string;
  pick: string;
  odds: number | null;
  prob: number | null;
  banker: boolean;
  href: string;
}

export default function SearchBox() {
  const [picks, setPicks] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/predictions/", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.rich) return;
        const rows: Row[] = [];
        const push = (r: any, sport: string, href: string, a: string, b: string) => {
          rows.push({
            id: r.id,
            sport,
            league: r.league || r.tourn || "",
            a,
            b,
            t: r.t || "",
            pick: r.final || r.pick || r.pred || "",
            odds: r.odds ?? null,
            prob: r.pickProb ?? null,
            banker: !!r.banker,
            href,
          });
        };
        (d.rich.football || []).forEach((r: any) => push(r, "⚽ Football", "/predictions/football/", r.home, r.away));
        (d.rich.basketball || []).forEach((r: any) => push(r, "🏀 Basketball", "/predictions/basketball/", r.home, r.away));
        (d.rich.tennis || []).forEach((r: any) => push(r, "🎾 Tennis", "/predictions/tennis/", r.p1, r.p2));
        setPicks(rows);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return picks
      .filter((p) => p.a.toLowerCase().includes(s) || p.b.toLowerCase().includes(s) || p.league.toLowerCase().includes(s))
      .slice(0, 30);
  }, [q, picks]);

  return (
    <div className="search-box-wrap">
      <input
        className="search-input"
        type="search"
        placeholder="e.g. Qarabag, Dellien, EuroLeague, Zenit…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search teams, players or leagues"
        autoFocus
      />

      {!loaded ? (
        <div className="callout callout-blue">Loading today&rsquo;s board…</div>
      ) : q.trim().length < 2 ? (
        <p className="search-hint">
          {picks.length} games on today&rsquo;s board. Start typing — 2 letters is enough.
        </p>
      ) : results.length === 0 ? (
        <div className="callout">
          Nothing on today&rsquo;s board matches “{q}”. Try a shorter team name or the league.
        </div>
      ) : (
        <div className="search-results">
          {results.map((r) => (
            <Link key={r.id} href={r.href} className="search-result">
              <span className="search-r-sport">{r.sport}</span>
              <span className="search-r-match">
                {r.a} <em>vs</em> {r.b}
              </span>
              <span className="search-r-meta">
                {r.league} · {r.t} WAT · <b>{r.pick}</b> @{r.odds ? r.odds.toFixed(2) : "—"}
                {r.prob != null && ` (${r.prob}%)`}
              </span>
              {r.banker && <span className="badge badge-banker">🏦</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
