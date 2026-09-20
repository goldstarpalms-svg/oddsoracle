import type { Metadata } from "next";
import Link from "next/link";
import SNAPSHOT from "@/lib/data-snapshot.json";

export const metadata: Metadata = {
  title: "Table Tennis — Setka Cup Intelligence",
  description:
    "Setka Cup first-set intelligence: O/U 18.5/19.5 model over 155,000 matches, head-to-head, player types, live scores.",
};

type TTGame = {
  match_id: string;
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
  };
};

function ouBadge(p: number) {
  const pct = Math.round(p * 100);
  if (p >= 0.65) return <span className="sig-strong">{pct}%</span>;
  if (p >= 0.55) return <span className="sig-value">{pct}%</span>;
  if (p > 0.45) return <span className="sig-fair">{pct}%</span>;
  return <span className="sig-pass">{pct}%</span>;
}

function WinBar({ p1, p2 }: { p1: number; p2: number }) {
  const a = Math.round(p1 * 100);
  const b = 100 - a;
  return (
    <div className="tt-winbar">
      <div className="tt-winfill" style={{ width: `${a}%` }} />
      <div className="tt-winlabels">
        <span className="tt-wl1">{a}%</span>
        <span className="tt-wl2">{b}%</span>
      </div>
    </div>
  );
}

function Row({ g, showKickoff }: { g: TTGame; showKickoff: boolean }) {
  const m = g.model;
  const fs = m.first_set;
  const isLive = g.status === "Live";
  const isFT = g.status === "Finished";
  const confCls =
    fs.confidence === "STRONG" ? "sig-strong" : fs.confidence === "MODERATE" ? "sig-value" : "sig-pass";
  const over = fs.p_over_18_5 >= 0.5;
  return (
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
            <span className="score">{g.score[0]} – {g.score[1]}</span>
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
          exp. <b>{fs.expected}</b> pts <span style={{ color: "#64748b" }}>(±{fs.std})</span>
        </div>
        <div className="tt-ou">
          <span>O18.5 {ouBadge(fs.p_over_18_5)}</span>
          <span>O19.5 {ouBadge(fs.p_over_19_5)}</span>
        </div>
      </td>
      <td>
        <span className={`oracle-signal ${confCls}`}>
          {fs.confidence === "WEAK" ? "PASS" : over ? "🎯" : "⏬"} {fs.pick} {fs.confidence === "WEAK" ? "" : "· "}
        </span>
        {fs.confidence !== "WEAK" && <span className="tt-prob">{Math.round(fs.prob * 100)}%</span>}
      </td>
      <td className="tt-h2h">
        {m.h2h.n > 0 ? (
          <>
            {m.h2h.n} met · {m.h2h.p1_wins}–{m.h2h.n - m.h2h.p1_wins}
            {m.h2h.over_18_5 != null && <div className="tt-h2hs">O18.5 {Math.round(m.h2h.over_18_5 * 100)}%</div>}
          </>
        ) : (
          "no H2H"
        )}
      </td>
      <td className="tt-data">
        {m.data.p1_matches}/{m.data.p2_matches}
        <div className="tt-types">{m.types.p1.split(" / ")[0]} vs {m.types.p2.split(" / ")[0]}</div>
      </td>
    </tr>
  );
}

export default function TableTennisPage() {
  const sk: any = (SNAPSHOT as any).setka || { games: [], history: { matches: 0, players: 0 } };
  const games: TTGame[] = sk.games || [];
  const inPlay = games.filter((g) => g.status === "Live");
  const upNext = games.filter((g) => g.status === "Scheduled");
  const done = games.filter((g) => g.status === "Finished");
  const strong = upNext.filter((g) => g.model.first_set.confidence === "STRONG").length;

  const th = (first: string) => (
    <tr>
      <th>{first}</th>
      <th>Match</th>
      <th>Score / Sets</th>
      <th>Match win</th>
      <th>First set</th>
      <th>O/U 18.5 read</th>
      <th>H2H</th>
      <th>Data</th>
    </tr>
  );

  return (
    <div className="page pad">
      <div className="container">
        <div className="terminal" style={{ marginTop: 18 }}>
          <div className="terminal-head">
            <span className="terminal-title">
              <span className="terminal-dot" /> TABLE TENNIS — SETKA CUP · FIRST-SET INTELLIGENCE
            </span>
            <Link href="/predictions/football/" className="terminal-link">
              Football board →
            </Link>
          </div>
          <div className="terminal-stats">
            <div>
              <b>{sk.history?.matches?.toLocaleString() ?? "—"}</b>
              <span>matches of history</span>
            </div>
            <div>
              <b>{sk.history?.players ?? "—"}</b>
              <span>players profiled</span>
            </div>
            <div>
              <b className="sig-value-txt">{inPlay.length}</b>
              <span>live now</span>
            </div>
            <div>
              <b>{upNext.length}</b>
              <span>up next</span>
            </div>
            <div>
              <b>{strong}</b>
              <span>strong O/U spots</span>
            </div>
          </div>

          {inPlay.length > 0 && (
            <>
              <div className="lt-sect">● IN PLAY</div>
              <div className="terminal-scroll">
                <table className="terminal-table live-table tt-table">
                  <thead>{th("Status")}</thead>
                  <tbody>{inPlay.map((g) => <Row key={g.match_id} g={g} showKickoff={false} />)}</tbody>
                </table>
              </div>
            </>
          )}

          <div className="lt-sect">UP NEXT</div>
          <div className="terminal-scroll">
            <table className="terminal-table live-table tt-table">
              <thead>{th("Time WAT")}</thead>
              <tbody>{upNext.map((g) => <Row key={g.match_id} g={g} showKickoff={true} />)}</tbody>
            </table>
          </div>

          {done.length > 0 && (
            <>
              <div className="lt-sect">FULL TIME</div>
              <div className="terminal-scroll">
                <table className="terminal-table live-table tt-table">
                  <thead>{th("Status")}</thead>
                  <tbody>{done.map((g) => <Row key={g.match_id} g={g} showKickoff={false} />)}</tbody>
                </table>
              </div>
            </>
          )}

          <div className="terminal-foot">
            Model: first-set points expectation (player career + last 20 + H2H + global base) → normal-distribution
            over/under, blended 55/45 with empirical over rates — a faithful port of the Setka Cup first-set engine.
            History through the latest export ({sk.history?.matches?.toLocaleString()} matches).
            O/U reads are model probabilities, not odds — compare with the book before staking. Probabilities are
            estimates, not guarantees.
          </div>
        </div>
      </div>
    </div>
  );
}
