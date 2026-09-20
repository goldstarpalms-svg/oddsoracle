"use client";

import { useState } from "react";
import type { OracleData } from "@/lib/rich";

const SIGNAL_STYLE: Record<string, { cls: string; icon: string }> = {
  "STRONG VALUE": { cls: "sig-strong", icon: "💎💎" },
  VALUE: { cls: "sig-value", icon: "💎" },
  FAIR: { cls: "sig-fair", icon: "⚖️" },
  "NO EDGE": { cls: "sig-none", icon: "— " },
  PASS: { cls: "sig-pass", icon: "" },
  AVOID: { cls: "sig-avoid", icon: "🚫" },
};

/**
 * The ODDSORACLE ENGINE read for one game: signal, score, model-vs-market,
 * multi-model agreement, Monte Carlo, data quality and the real Why factors.
 */
export default function OraclePanel({ o, home, away }: { o: OracleData; home: string; away: string }) {
  const [open, setOpen] = useState(false);
  const s = SIGNAL_STYLE[o.signal] || SIGNAL_STYLE["NO EDGE"];
  const isPass = o.signal === "PASS" || o.signal === "NO EDGE" || o.signal === "AVOID";

  return (
    <div className="oracle-panel">
      <div className="oracle-top">
        <span className={`oracle-signal ${s.cls}`}>
          {s.icon} {o.signal}
        </span>
        <span className="oracle-score" title="Analytical signal score (0-100). It is NOT a chance of winning — it combines edge, model confidence, engine agreement and data quality.">
          ORACLE <b>{o.oracle_score}</b>/100
        </span>
        <span className="oracle-meta">
          {o.agreement} engines agree · data {o.data_quality}%
        </span>
      </div>

      {o.oc && (
        <div className="oc-strip">
          <span className="oc-label">
            {o.prices_live ? "🔴 LIVE 1X2" : "1X2"} · BEST OF {o.oc.n_books} BOOKS
          </span>
          <span className="oc-odds">
            {["h", "x", "a"].map((k) => (
              <span key={k} style={{ marginRight: 6 }}>
                <b>{o.oc![k as "h" | "x" | "a"].toFixed(2)}</b>
              </span>
            ))}
          </span>
          <span className="oc-meta">
            {o.prices_live ? "live feed" : "today"} {o.oc.feed_ts ? `· ${fmtWAT(o.oc.feed_ts)}` : ""}
          </span>
        </div>
      )}

      <div className="oracle-rows">
        <div className="oracle-row">
          <span className="oracle-k">Model (simulated)</span>
          <span className="oracle-v">
            H {o.model_probability[0]}% · D {o.model_probability[1]}% · A {o.model_probability[2]}%
          </span>
        </div>
        {o.market_probability && (
          <div className="oracle-row">
            <span className="oracle-k">Market (price)</span>
            <span className="oracle-v">
              H {o.market_probability[0]}% · D {o.market_probability[1]}% · A {o.market_probability[2]}%
            </span>
          </div>
        )}
        {o.edge != null && (
          <div className="oracle-row">
            <span className="oracle-k">Edge {o.selection}</span>
            <span className={`oracle-v ${o.edge >= 0 ? "edge-pos" : "edge-neg"}`}>
              {o.edge >= 0 ? "+" : ""}
              {o.edge}pp{o.ev_pct != null ? ` · EV ${o.ev_pct >= 0 ? "+" : ""}${o.ev_pct}%` : ""}
            </span>
          </div>
        )}
        {isPass && (
          <div className="oracle-row oracle-pass-row">
            <span className="oracle-k">Verdict</span>
            <span className="oracle-v">
              {o.signal === "AVOID"
                ? "The price is against us — no bet here."
                : "No meaningful pricing edge detected — we pass on this one."}
            </span>
          </div>
        )}
      </div>

      <div className="oracle-models">
        {o.models.map((m) => (
          <span key={m.name} className={`oracle-model ${m.agrees ? "agree" : "disagree"}`} title={`${m.name}: ${m.p[0]}/${m.p[1]}/${m.p[2]} → ${m.pick}`}>
            {m.agrees ? "✓" : "✗"} {m.name} {m.pick}
          </span>
        ))}
      </div>

      <button className="why-toggle oracle-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "▾ Close the analysis" : `▸ Why ${o.signal === "PASS" ? "we pass" : "this call"} — ${o.why.plus.length + o.why.minus.length} real inputs`}
      </button>
      {open && (
        <div className="oracle-why">
          <div className="oracle-mc">
            <b>Monte Carlo (10,000 simulated matches):</b> {o.mc.h}/{o.mc.x}/{o.mc.a} · Over 2.5 {o.mc.o25}% · BTTS {o.mc.btts}%
            {o.mc.top2.length > 0 && <> · top scores {o.mc.top2.join(" or ")}</>}
          </div>
          <div className="oracle-lambda">
            Expected goals — {home} <b>{o.lambda[0].toFixed(2)}</b> : <b>{o.lambda[1].toFixed(2)}</b> {away}
          </div>
          <ul className="oracle-factors">
            {o.why.plus.map((f, i) => (
              <li key={`p${i}`} className="oracle-plus">+ {f}</li>
            ))}
            {o.why.minus.map((f, i) => (
              <li key={`m${i}`} className="oracle-minus">− {f}</li>
            ))}
          </ul>
          <p className="oracle-version">{o.model_version} · probabilities are estimates, not guarantees</p>
        </div>
      )}
    </div>
  );
}

function fmtWAT(iso: string): string {
  try {
    const d = new Date(iso);
    const w = new Date(d.getTime() + 3600000);
    return w.toISOString().slice(11, 16) + " WAT";
  } catch {
    return "";
  }
}
