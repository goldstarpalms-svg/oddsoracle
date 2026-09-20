"use client";

import { Fragment, useMemo, useState } from "react";

export interface TTProfile {
  n: number;
  wins: number;
  win_rate: number;
  recent_win_rate: number;
  pts_per_set: number;
  pts_against_per_set: number;
  first_set_win_rate: number;
  last10: number[];
  thin: boolean;
}

export interface TTGame {
  match_id: string | number;
  time_wat: string | null;
  tournament: string;
  status: string;
  p1: string;
  p2: string;
  set_scores: string | null;
  score: [string | number | null, string | number | null] | null;
  winner: string | null;
  model: {
    win: { p1: number; p2: number };
    first_set: {
      expected: number;
      std: number;
      p_over_18_5: number;
      p_over_19_5: number;
      pick: string;
      prob: number;
      confidence: string;
    };
    total_points: { expected: number; p_over_75_5: number };
    h2h: { n: number; p1_wins: number; avg_first: number | null; over_18_5: number | null };
    data: { p1_matches: number; p2_matches: number };
    types: { p1: string; p2: string };
    sets?: { expected: number; p_over_3_5: number; pick: string; prob: number };
    profiles?: { p1: TTProfile | null; p2: TTProfile | null };
  };
}

function ouBadge(p: number) {
  const pct = Math.round(p * 100);
  if (p >= 0.65) return <span className="sig sig-strong">{pct}%</span>;
  if (p >= 0.55) return <span className="sig sig-value">{pct}%</span>;
  if (p > 0.45) return <span className="sig sig-fair">{pct}%</span>;
  return <span className="sig sig-pass">{pct}%</span>;
}

function WinBar({ p1, p2 }: { p1: number; p2: number }) {
  const a = Math.round(p1 * 100);
  return (
    <div className="tt-winbar">
      <div className="tt-winfill" style={{ width: `${a}%` }} />
      <div className="tt-winlabels">
        <span className="tt-wl1">{a}%</span>
        <span className="tt-wl2">{100 - a}%</span>
      </div>
    </div>
  );
}

function FormDots({ last }: { last: number[] }) {
  if (!last?.length) return null;
  return (
    <span className="tt-form" title={`last ${last.length}: ${last.map((x) => (x ? "W" : "L")).join("")}`}>
      {last.map((x, i) => (
        <i key={i} className={x ? "dot-w" : "dot-l"} />
      ))}
    </span>
  );
}

function Dossier({ name, pr }: { name: string; pr: TTProfile | null }) {
  if (!pr) {
    return (
      <div className="tt-dossier">
        <b>{name}</b>
        <p className="tt-nodata">No history in the Setka database — data unavailable rather than guessed.</p>
      </div>
    );
  }
  return (
    <div className="tt-dossier">
      <div className="tt-dossier-head">
        <b>{name}</b>
        {pr.thin && <span className="sig sig-fair">small sample ({pr.n})</span>}
      </div>
      <div className="tt-dossier-grid">
        <span>
          <i>record</i> {pr.wins}–{pr.n - pr.wins} ({pr.win_rate}%)
        </span>
        <span>
          <i>last 20</i> {pr.recent_win_rate}%
        </span>
        <span>
          <i>pts/set</i> {pr.pts_per_set}
        </span>
        <span>
          <i>against</i> {pr.pts_against_per_set}/set
        </span>
        <span>
          <i>1st set won</i> {pr.first_set_win_rate}%
        </span>
        <span>
          <i>form</i> <FormDots last={pr.last10} />
        </span>
      </div>
      <p className="tt-dossier-note">All figures from {pr.n} recorded Setka matches — nothing invented.</p>
    </div>
  );
}

export default function TTBoard({ games }: { games: TTGame[] }) {
  const [q, setQ] = useState("");
  const [player, setPlayer] = useState("all");
  const [tourn, setTourn] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  const players = useMemo(
    () => Array.from(new Set(games.flatMap((g) => [g.p1, g.p2]))).sort(),
    [games]
  );
  const tournaments = useMemo(
    () =>
      Array.from(new Set(games.map((g) => g.tournament.replace(/^\d{4}-\d{2}-\d{2}\s/, "")))).sort(),
    [games]
  );

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (q === "" ||
            g.p1.toLowerCase().includes(q.toLowerCase()) ||
            g.p2.toLowerCase().includes(q.toLowerCase())) &&
          (player === "all" || g.p1 === player || g.p2 === player) &&
          (tourn === "all" || g.tournament.replace(/^\d{4}-\d{2}-\d{2}\s/, "") === tourn)
      ),
    [games, q, player, tourn]
  );

  const th = (first: string) => (
    <tr>
      <th>{first}</th>
      <th>Match</th>
      <th>Score / Sets</th>
      <th>Match win</th>
      <th>First set O/U</th>
      <th>Sets O/U 3.5</th>
      <th>18.5 read</th>
      <th>H2H</th>
      <th>Profile</th>
    </tr>
  );

  const row = (g: TTGame, showKickoff: boolean) => {
    const m = g.model;
    const fs = m.first_set;
    const isLive = g.status === "Live";
    const isFT = g.status === "Finished";
    const confCls =
      fs.confidence === "STRONG" ? "sig-strong" : fs.confidence === "MODERATE" ? "sig-value" : "sig-pass";
    const over = fs.p_over_18_5 >= 0.5;
    const rowOpen = open === String(g.match_id);
    return (
      <Fragment key={String(g.match_id)}>
      <tr className={isLive ? "row-live" : ""}>
        <td className="lt-st">
          {isLive ? (
            <span className="live-badge">
              <span className="live-dot" />LIVE
            </span>
          ) : (
            <span className={isFT ? "st-ft" : "st-ns"}>{showKickoff ? g.time_wat || "—" : isFT ? "FT" : "NS"}</span>
          )}
        </td>
        <td className="lt-match">
          <b>{g.p1}</b> <em>v</em> <b>{g.p2}</b>
          <span className="lt-league">{g.tournament.replace(/^\d{4}-\d{2}-\d{2}\s/, "")}</span>
        </td>
        <td className="lt-score">
          {g.score && g.score[0] != null ? (
            <>
              <span className="score">
                {g.score[0]} – {g.score[1]}
              </span>
              {g.set_scores && <span className="tt-sets">{g.set_scores}</span>}
            </>
          ) : isFT && g.winner ? (
            <span className="tt-winner">🏆 {g.winner.split(" ").slice(-1)[0]}</span>
          ) : (
            "—"
          )}
        </td>
        <td>
          <WinBar p1={m.win.p1} p2={m.win.p2} />
        </td>
        <td className="tt-fs">
          <div className="tt-exp">
            exp. <b>{fs.expected}</b> pts <span style={{ color: "var(--text-faint)" }}>(±{fs.std})</span>
          </div>
          <div className="tt-ou">
            <span>O18.5 {ouBadge(fs.p_over_18_5)}</span>
            <span>O19.5 {ouBadge(fs.p_over_19_5)}</span>
          </div>
        </td>
        <td>
          {m.sets ? (
            <>
              <div className="tt-exp">
                exp. <b>{m.sets.expected}</b> sets
              </div>
              <div className="tt-ou">
                <span>O3.5 {ouBadge(m.sets.p_over_3_5)}</span>
              </div>
            </>
          ) : (
            <span style={{ color: "var(--text-faint)" }}>unavailable</span>
          )}
        </td>
        <td>
          <span className={`oracle-signal ${confCls}`}>
            {fs.confidence === "WEAK" ? "PASS" : over ? "🎯" : "⏬"} {fs.pick}
          </span>
          {fs.confidence !== "WEAK" && <span className="tt-prob">{Math.round(fs.prob * 100)}%</span>}
        </td>
        <td className="tt-h2h">
          {m.h2h.n > 0 ? (
            <>
              {m.h2h.n} met · {m.h2h.p1_wins}–{m.h2h.n - m.h2h.p1_wins}
              {m.h2h.over_18_5 != null && (
                <div className="tt-h2hs">O18.5 {Math.round(m.h2h.over_18_5 * 100)}%</div>
              )}
            </>
          ) : (
            "no H2H"
          )}
        </td>
        <td>
          <button className="tt-profile-btn" onClick={() => setOpen(rowOpen ? null : String(g.match_id))} aria-expanded={rowOpen}>
            {rowOpen ? "hide ▴" : "view ▾"}
          </button>
        </td>
      </tr>
      {rowOpen && (
        <tr className="tt-dossier-row">
          <td colSpan={9} className="tt-dossier-cell">
            <div className="tt-dossier-wrap">
              <Dossier name={g.p1} pr={m.profiles?.p1 ?? null} />
              <Dossier name={g.p2} pr={m.profiles?.p2 ?? null} />
              <div className="tt-types-line">
                <b>{g.p1}:</b> {m.types.p1} · <b>{g.p2}:</b> {m.types.p2}
              </div>
            </div>
          </td>
        </tr>
      )}
      </Fragment>
    );
  };

  const inPlay = filtered.filter((g) => g.status === "Live");
  const upNext = filtered.filter((g) => g.status === "Scheduled");
  const done = filtered.filter((g) => g.status === "Finished");

  return (
    <div className="tt-board">
      <div className="tt-filters">
        <input
          className="tt-search"
          type="search"
          placeholder="Search player…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search players"
        />
        <select value={player} onChange={(e) => setPlayer(e.target.value)} aria-label="Filter by player">
          <option value="all">All players</option>
          {players.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={tourn} onChange={(e) => setTourn(e.target.value)} aria-label="Filter by tournament">
          <option value="all">All boards</option>
          {tournaments.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="tt-count">{filtered.length} of {games.length}</span>
      </div>

      {inPlay.length > 0 && (
        <>
          <div className="lt-sect">● IN PLAY</div>
          <div className="terminal-scroll">
            <table className="terminal-table live-table tt-table">
              <thead>{th("Status")}</thead>
              <tbody>{inPlay.map((g) => row(g, false))}</tbody>
            </table>
          </div>
        </>
      )}

      <div className="lt-sect">UP NEXT</div>
      <div className="terminal-scroll">
        <table className="terminal-table live-table tt-table">
          <thead>{th("Time WAT")}</thead>
          <tbody>{upNext.map((g) => row(g, true))}</tbody>
        </table>
      </div>

      {done.length > 0 && (
        <>
          <div className="lt-sect">FULL TIME</div>
          <div className="terminal-scroll">
            <table className="terminal-table live-table tt-table">
              <thead>{th("Status")}</thead>
              <tbody>{done.map((g) => row(g, false))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
