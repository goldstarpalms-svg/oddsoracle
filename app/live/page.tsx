"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type LiveGame = {
  key: string;
  home: string;
  away: string;
  league: string;
  kickoff: string | null;
  state: string;
  shortDetail: string;
  clock: string | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  odds: { h: number; x: number; a: number; nBooks: number; feedTs: string | null; live: boolean } | null;
  model: number[] | null;
  pick: string | null;
  signal: string | null;
  edge: number | null;
  oracleScore: number | null;
  ocUrl: string | null;
};

type LiveBody = {
  ok: boolean;
  ts: string;
  dataDate: string;
  nInPlay: number;
  games: LiveGame[];
};

const sigCls = (s: string | null | undefined) =>
  s === "STRONG VALUE" ? "sig-strong" : s === "VALUE" ? "sig-value" : s === "FAIR" ? "sig-fair" : s === "AVOID" ? "sig-avoid" : s === "PASS" ? "sig-pass" : "sig-pass";

const stLabel = (g: LiveGame) => {
  if (g.state === "in") return g.clock ? `${g.clock} 2nd half` : "Live";
  if (g.state === "break") return "HT";
  if (g.state === "post") return "FT";
  return g.kickoff ? g.kickoff : "NS";
};

export default function LivePage() {
  const [data, setData] = useState<LiveBody | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ago, setAgo] = useState(0);
  const tsRef = useRef<number>(0);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const d = await res.json();
        if (!stop) {
          if (d.ts) tsRef.current = new Date(d.ts).getTime();
          setData(d);
          setErr(null);
        }
      } catch {
        if (!stop) setErr("Live feed unavailable — retrying.");
      }
    };
    load();
    const poll = setInterval(load, 60000);
    const tick = setInterval(() => {
      if (tsRef.current) setAgo(Math.max(0, Math.round((Date.now() - tsRef.current) / 1000)));
    }, 1000);
    return () => {
      stop = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const inPlay = data?.games.filter((g) => g.state === "in" || g.state === "break") || [];
  const upNext = data?.games.filter((g) => g.state === "pre") || [];
  const done = data?.games.filter((g) => g.state === "post") || [];

  const Row = ({ g }: { g: LiveGame }) => {
    const o = g.odds;
    return (
      <tr className={g.state === "in" || g.state === "break" ? "row-live" : ""}>
        <td className="lt-st">
          {g.state === "in" || g.state === "break" ? (
            <span className="live-badge"><span className="live-dot" />{stLabel(g)}</span>
          ) : (
            <span className={g.state === "post" ? "st-ft" : "st-ns"}>{stLabel(g)}</span>
          )}
        </td>
        <td className="lt-match">
          <b>{g.home}</b> <em>v</em> <b>{g.away}</b>
          <span className="lt-league">{g.league}</span>
        </td>
        <td className="lt-score">
          {(g.homeScore ?? null) !== null && g.state !== "pre" ? (
            <span className="score">
              {g.homeScore} – {g.awayScore}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="lt-model">{g.model ? `${g.model[0]}/${g.model[1]}/${g.model[2]}` : "—"}</td>
        <td className="lt-odds">
          {o ? (
            <>
              <span className={o.h === Math.min(o.h, o.x, o.a) ? "odds-pick" : ""}>{o.h.toFixed(2)}</span>
              <span className={o.x === Math.min(o.h, o.x, o.a) ? "odds-pick" : ""}>{o.x.toFixed(2)}</span>
              <span className={o.a === Math.min(o.h, o.x, o.a) ? "odds-pick" : ""}>{o.a.toFixed(2)}</span>
              <span className="lt-oddsmeta">
                {o.live ? <span className="live-badge sm"><span className="live-dot" />LIVE</span> : `as of ${fmtTs(o.feedTs)}`}
              </span>
            </>
          ) : (
            "—"
          )}
        </td>
        <td>
          {g.pick ? (
            <span className={`oracle-signal ${sigCls(g.signal)}`}>
              {g.pick} · {g.signal}
            </span>
          ) : (
            "—"
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="page pad">
      <div className="container">
        <div className="terminal" style={{ marginTop: 18 }}>
          <div className="terminal-head">
            <span className="terminal-title">
              <span className="terminal-dot" /> LIVE MATCH CENTER — {data?.dataDate || "…"}
            </span>
            <span className="terminal-link" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span className="lt-updated">
                {data ? `updated ${ago}s ago` : "loading…"} · refreshes 60s
              </span>
              <Link href="/predictions/football/">Full board →</Link>
            </span>
          </div>
          <div className="terminal-stats">
            <div>
              <b className="sig-value-txt">{data?.nInPlay ?? 0}</b>
              <span>live now</span>
            </div>
            <div>
              <b>{upNext.length}</b>
              <span>up next</span>
            </div>
            <div>
              <b>{done.length}</b>
              <span>finished</span>
            </div>
            <div>
              <b>{(data?.games || []).filter((g) => g.odds?.live).length}</b>
              <span>live odds</span>
            </div>
          </div>

          {err && !data && <p className="live-err">{err}</p>}
          {!data && !err && <p className="live-err">Connecting to live feed…</p>}

          {data && inPlay.length > 0 && (
            <>
              <div className="lt-sect">● IN PLAY</div>
              <div className="terminal-scroll">
                <table className="terminal-table live-table">
                  <thead>
                    <tr>
                      <th>Status</th><th>Match</th><th>Score</th><th>Model H/D/A</th><th>Live 1X2 (best)</th><th>Oracle signal</th>
                    </tr>
                  </thead>
                  <tbody>{inPlay.map((g) => <Row key={g.key} g={g} />)}</tbody>
                </table>
              </div>
            </>
          )}

          {data && upNext.length > 0 && (
            <>
              <div className="lt-sect">UP NEXT</div>
              <div className="terminal-scroll">
                <table className="terminal-table live-table">
                  <thead>
                    <tr>
                      <th>Kickoff</th><th>Match</th><th>Score</th><th>Model H/D/A</th><th>1X2 (best)</th><th>Oracle signal</th>
                    </tr>
                  </thead>
                  <tbody>{upNext.map((g) => <Row key={g.key} g={g} />)}</tbody>
                </table>
              </div>
            </>
          )}

          {data && done.length > 0 && (
            <>
              <div className="lt-sect">FULL TIME</div>
              <div className="terminal-scroll">
                <table className="terminal-table live-table">
                  <thead>
                    <tr>
                      <th>Status</th><th>Match</th><th>Score</th><th>Model H/D/A</th><th>1X2 (best)</th><th>Oracle signal</th>
                    </tr>
                  </thead>
                  <tbody>{done.map((g) => <Row key={g.key} g={g} />)}</tbody>
                </table>
              </div>
            </>
          )}

          <div className="terminal-foot">
            Scores: ESPN live scoreboards · Odds: OddsChecker best of 26 UK books (in-play odds refresh from the book feed) ·
            Live center covers today&rsquo;s Oracle board leagues (EPL, Championship, La Liga, Serie A/B, Ligue 1, Bundesliga, Eredivisie, SP, Süper Lig).
            Model % = Oracle Engine v2.0 (Poisson + 10,000 Monte Carlo sims) — a signal, not a guarantee.
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtTs(ts: string | null) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    // convert to WAT (UTC+1)
    const w = new Date(d.getTime() + 3600000);
    return w.toISOString().slice(11, 16) + " WAT";
  } catch {
    return "—";
  }
}
