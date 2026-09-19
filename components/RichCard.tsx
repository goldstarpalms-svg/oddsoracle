"use client";

import { useState } from "react";
import type { AmPick, BbPick, FbPick, OptRow, TnPick } from "@/lib/rich";
import { h2hRow, h2hOuCtxt } from "@/lib/rich";
import TimeChip from "./TimeChip";

/** Three-segment (1/X/2) or two-segment (home/away) probability bar. */
export function ProbBar({
  pct,
  picked,
  labels,
}: {
  pct: (number | null)[];
  picked: string; // "1" | "X" | "2" / "h" | "a"
  labels: string[];
}) {
  const keys = pct.length === 3 ? ["1", "X", "2"] : ["h", "a"];
  return (
    <div className="probbar" aria-label={labels.join(" ")}>
      <div className="probbar-segs">
        {pct.map((v, i) => {
          const w = v == null ? 0 : Math.max(2, Math.min(100, v));
          const isPick = keys[i] === picked;
          return (
            <div
              key={i}
              className={`probbar-seg seg-${keys[i]} ${isPick ? "picked" : ""}`}
              style={{ width: `${w}%` }}
              title={`${labels[i]}: ${v ?? "—"}%`}
            />
          );
        })}
      </div>
      <div className="probbar-labels">
        {labels.map((l, i) => (
          <span key={i} className={keys[i] === picked ? "picked" : ""}>
            {l} · {pct[i] ?? "—"}%
          </span>
        ))}
      </div>
    </div>
  );
}

function OddsChip({ odds }: { odds: number | null }) {
  return (
    <span className={`odds-chip ${odds != null && odds >= 1.8 ? "odds-hot" : ""}`}>
      {odds != null ? `@${odds.toFixed(2)}` : "odds —"}
    </span>
  );
}

function Badges({ banker, value, extra }: { banker?: boolean; value?: boolean; extra?: string }) {
  if (!banker && !value && !extra) return null;
  return (
    <div className="rich-badges">
      {banker && (
        <span className="badge badge-banker" title="Model confidence of 70% or higher — a statistical label, not a guarantee.">
          🏦 BANKER
        </span>
      )}
      {value && (
        <span className="badge badge-value" title="Model sees more chance than the price implies — the odds look generous for the risk.">
          💎 VALUE
        </span>
      )}
      {extra && <span className="badge badge-src">{extra}</span>}
    </div>
  );
}

const srcBadge = (src: string): string | null =>
  src === "FOREBET" ? "FOREBET PICK" : src === "MODEL" ? "MODEL PICK" : src === "FUSION" ? "FUSION ✓" : null;

/** Value transparency: model chance vs market-implied chance vs edge. */
function EdgeRow({ p }: { p: FbPick }) {
  if (p.edge == null || p.pickProb == null) return null;
  const implied = p.mktImp ?? (p.odds != null ? Math.round(100 / p.odds) : null);
  if (implied == null) return null;
  return (
    <div className="edge-row">
      <span>Model {p.pickProb}%</span>
      <span className="edge-sep">·</span>
      <span>Market ~{implied}%</span>
      <span className="edge-sep">·</span>
      <span className={p.edge >= 0 ? "edge-pos" : "edge-neg"}>
        Edge {p.edge >= 0 ? "+" : ""}
        {p.edge}pp
      </span>
    </div>
  );
}

/** SaferStake-style safety tag from a model probability. */
function mktTag(p: number | null) {
  if (p == null) return null;
  if (p >= 70) return <span className="mkt-tag mkt-safe">🟢 SAFE</span>;
  if (p >= 55) return <span className="mkt-tag mkt-steady">🟡 STEADY</span>;
  return <span className="mkt-tag mkt-risky">🔴 RISKY</span>;
}

/** Every option the model prices for this game — expandable per card. */
function MktMenu({ p }: { p: FbPick }) {
  const [open, setOpen] = useState(false);
  const m = p.model;
  if (!m || (m.o15 == null && m.dc1x == null && m.btts == null)) return null;
  const side = (v: number | null) => (v == null ? "—" : v >= 50 ? "Over" : "Under");
  const hCtx = p.h2h ? h2hOuCtxt(p.h2h) : null;
  const rows: { name: string; detail: string; call: string; tag: number | null }[] = [];
  if (p.h2h) {
    const hr = h2hRow(p.h2h, p.home, p.away, "goals");
    if (hr) rows.push(hr);
  }
  if (m.p) rows.push({ name: "Match winner (1/X/2)", detail: `1 ${m.p[0]}% · X ${m.p[1]}% · 2 ${m.p[2]}%`, call: p.final, tag: Math.max(...m.p) });
  if (m.o15 != null) rows.push({ name: "Over 1.5 goals", detail: `${m.o15}% for over`, call: side(m.o15), tag: Math.max(m.o15, 100 - m.o15) });
  if (m.o25 != null) rows.push({ name: "Over 2.5 goals", detail: `${m.o25}% for over${hCtx ? ` · ${hCtx}` : ""}`, call: side(m.o25), tag: Math.max(m.o25, 100 - m.o25) });
  if (m.o35 != null) rows.push({ name: "Over 3.5 goals", detail: `${m.o35}% for over`, call: side(m.o35), tag: Math.max(m.o35, 100 - m.o35) });
  if (m.btts != null) rows.push({ name: "Both teams score", detail: `Yes ${m.btts}% / No ${m.no_btts ?? 100 - m.btts}%`, call: m.btts >= 50 ? "Yes" : "No", tag: Math.max(m.btts, m.no_btts ?? 0) });
  if (m.dc1x != null) {
    const best = Math.max(m.dc1x, m.dcx2 ?? 0, m.dc12 ?? 0);
    const call = best === m.dc1x ? "1X (Home or draw)" : best === (m.dcx2 ?? 0) ? "X2 (Draw or away)" : "12 (No draw)";
    rows.push({ name: "Double chance", detail: `1X ${m.dc1x}% · X2 ${m.dcx2 ?? "—"}% · No draw ${m.dc12 ?? "—"}%`, call, tag: best });
  }
  if (m.dnbH != null) rows.push({ name: "Draw no bet", detail: `Home ${m.dnbH}% / Away ${m.dnbA ?? "—"}%`, call: m.dnbH >= (m.dnbA ?? 0) ? `Home (${p.home})` : `Away (${p.away})`, tag: Math.max(m.dnbH, m.dnbA ?? 0) });
  if (m.ahH != null) rows.push({ name: "Handicap (home -1)", detail: `Home -1: ${m.ahH}% / Away: ${m.ahA ?? "—"}%`, call: m.ahH >= (m.ahA ?? 0) ? p.home : `${p.away} +1`, tag: Math.max(m.ahH, m.ahA ?? 0) });
  if (m.cs1) rows.push({ name: "Correct score", detail: `Model: ${m.cs1} (or ${m.cs2})${p.fb_score ? ` · Forebet: ${p.fb_score}` : ""}`, call: m.cs1, tag: null });
  return (
    <div className="mkt-menu">
      <button className="why-toggle mkt-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "▾ Hide all options" : `▸ All options (${rows.length}) — the full menu`}
      </button>
      {open && (
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Model says</th>
              <th>Our call</th>
              <th>Tag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="mkt-name">{r.name}</td>
                <td className="mkt-detail">{r.detail}</td>
                <td className="mkt-call">{r.call}</td>
                <td>{mktTag(r.tag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Generic all-options menu: every market the Nigerian bookies list, with OUR call (same look as MktMenu). */
function OptMenu({ rows }: { rows: OptRow[] | null | undefined }) {
  const [open, setOpen] = useState(false);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="mkt-menu">
      <button className="why-toggle mkt-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "▾ Hide all options" : `▸ All options (${rows.length}) — the full menu`}
      </button>
      {open && (
        <table className="mkt-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>We expect</th>
              <th>Our call</th>
              <th>Tag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="mkt-name">{r.name}</td>
                <td className="mkt-detail">{r.detail}</td>
                <td className="mkt-call">{r.call}</td>
                <td>{mktTag(r.tag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Why({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="why">
      <button className="why-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "▾ Hide" : "▸ Why this pick?"}
      </button>
      {open && <p className="why-text">{text}</p>}
    </div>
  );
}

export function FootballCard({ p }: { p: FbPick }) {
  const pickedKey = p.final.startsWith("Home") ? "1" : p.final.startsWith("Away") ? "2" : "X";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.league}</span>
        <TimeChip t={p.t} />
        {srcBadge(p.src) && <span className="badge badge-src">{srcBadge(p.src)}</span>}
      </div>

      <div className="rich-teams">
        <span>{p.home}</span>
        <span className="pred-vs">vs</span>
        <span>{p.away}</span>
      </div>

      {p.fb_pct ? (
        <ProbBar pct={[p.fb_pct[0], p.fb_pct[1], p.fb_pct[2]]} picked={pickedKey} labels={["1 (Home)", "X (Draw)", "2 (Away)"]} />
      ) : (
        p.model?.p && <ProbBar pct={[p.model.p[0], p.model.p[1], p.model.p[2]]} picked={pickedKey} labels={["1 (Home)", "X (Draw)", "2 (Away)"]} />
      )}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.final}</span>
        <OddsChip odds={p.odds} />
        {p.fb_score && <span className="score-chip">⚽ {p.fb_score}</span>}
        {p.ou && <span className="score-chip">Σ {p.ou}</span>}
      </div>

      <EdgeRow p={p} />

      <MktMenu p={p} />
      <Badges banker={p.banker} value={p.value} />
      <Why text={p.why} />
    </article>
  );
}

export function BasketballCard({ p }: { p: BbPick }) {
  const pickedKey = /^1/.test(String(p.fb_pick || p.pick)) ? "h" : "a";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""} ${p.deep ? "rich-deep" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.league}</span>
        <TimeChip t={p.t} />
        {p.deep && <span className="badge badge-src">DEEP CRACK</span>}
      </div>

      <div className="rich-teams">
        <span>{p.home}</span>
        <span className="pred-vs">vs</span>
        <span>{p.away}</span>
      </div>

      {p.fb_prob ? <ProbBar pct={[p.fb_prob[0], p.fb_prob[1]]} picked={pickedKey} labels={["Home", "Away"]} /> : null}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.pick || "—"}</span>
        <OddsChip odds={p.odds} />
        {p.fb_score && <span className="score-chip">🏀 {p.fb_score}</span>}
        {p.fb_avg != null && <span className="score-chip">Σ avg {p.fb_avg}</span>}
      </div>

      {p.conf && <div className="rich-model">Forebet confidence: <b>{p.conf}</b></div>}
      <OptMenu rows={p.opts} />
      <Badges banker={p.banker} value={p.value} />
      <Why text={p.why || (p.fb_score ? `Forebet score ${p.fb_score}.` : "")} />
    </article>
  );
}

export function AmericanCard({ p }: { p: AmPick }) {
  const pickedKey = p.pickSide === "1" ? "h" : "a";
  const icon = p.sport === "MLB" ? "⚾" : "🏈";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.league}</span>
        <TimeChip t={p.t} />
      </div>

      <div className="rich-teams">
        <span>{p.home}</span>
        <span className="pred-vs">vs</span>
        <span>{p.away}</span>
      </div>

      {p.prob ? <ProbBar pct={[p.prob[0], p.prob[1]]} picked={pickedKey} labels={[p.home, p.away]} /> : null}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.pick || "—"}</span>
        <OddsChip odds={p.odds} />
        {p.score && <span className="score-chip">{icon} {p.score}</span>}
        {p.total != null && <span className="score-chip">{icon} total {p.total}</span>}
      </div>

      {p.pickProb != null && (
        <div className="rich-model">
          {p.sport === "MLB" ? "Market reads this at " : "Forebet reads this at "}
          <b>{p.pickProb}%</b>
        </div>
      )}
      <OptMenu rows={p.opts} />
      <Badges banker={p.banker} value={p.value} />
      <Why text={p.why || ""} />
    </article>
  );
}

export function TennisCard({ p }: { p: TnPick }) {
  const pickedKey = /^1/.test(String(p.pred)) ? "h" : "a";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.tourn}</span>
        <TimeChip t={p.t} />
      </div>

      <div className="rich-teams">
        <span>{p.p1}</span>
        <span className="pred-vs">vs</span>
        <span>{p.p2}</span>
      </div>

      {p.prob ? <ProbBar pct={[p.prob[0], p.prob[1]]} picked={pickedKey} labels={["Player 1", "Player 2"]} /> : null}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.pred || "—"}</span>
        <OddsChip odds={p.odds} />
        {p.sets && <span className="score-chip">🎾 sets {p.sets}</span>}
      </div>

      <OptMenu rows={p.opts} />
      <Badges banker={p.banker} value={p.value} />
      <Why text={p.why} />
    </article>
  );
}
