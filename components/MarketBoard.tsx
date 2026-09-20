"use client";

import { useMemo, useState } from "react";
import type { FbPick } from "@/lib/rich";
import { mktTagLike } from "./mktTag";

type MktKey = "1x2" | "ou" | "btts" | "dc" | "dnb" | "ht" | "htft";

const MKTS: { key: MktKey; label: string }[] = [
  { key: "1x2", label: "1X2" },
  { key: "ou", label: "Over/Under 2.5" },
  { key: "btts", label: "Both to score" },
  { key: "dc", label: "Double chance" },
  { key: "dnb", label: "Draw no bet" },
  { key: "ht", label: "Half time" },
  { key: "htft", label: "HT/FT" },
];

/**
 * Forebet-style market boards: one table per market, every game listed with
 * the model's numbers and our call for THAT market — the same 10-tab layout
 * forebet uses for today's football.
 */
export default function MarketBoard({ items }: { items: FbPick[] }) {
  const [mkt, setMkt] = useState<MktKey>("1x2");

  const rows = useMemo(() => {
    const out: { p: FbPick; detail: string; call: string; tag: number | null; edge: number | null }[] = [];
    for (const p of items) {
      const m = p.model;
      if (mkt === "1x2") {
        const pct = p.fb_pct || (m?.p as [number, number, number] | null);
        if (!pct) continue;
        const best = Math.max(pct[0], pct[1], pct[2]);
        const call = best === pct[0] ? "1 (Home)" : best === pct[1] ? "X (Draw)" : "2 (Away)";
        out.push({ p, detail: `1 ${pct[0]}% · X ${pct[1]}% · 2 ${pct[2]}%`, call, tag: best, edge: p.edge });
      } else if (mkt === "ou") {
        if (m?.o25 == null) continue;
        out.push({ p, detail: `Over 2.5: ${m.o25}% / Under ${100 - m.o25}%`, call: m.o25 >= 50 ? "Over 2.5" : "Under 2.5", tag: Math.max(m.o25, 100 - m.o25), edge: null });
      } else if (mkt === "btts") {
        if (m?.btts == null) continue;
        out.push({ p, detail: `Yes ${m.btts}% / No ${m.no_btts ?? 100 - m.btts}%`, call: m.btts >= 50 ? "Yes" : "No", tag: Math.max(m.btts, m.no_btts ?? 0), edge: null });
      } else if (mkt === "dc") {
        if (m?.dc1x == null) continue;
        const best = Math.max(m.dc1x, m.dcx2 ?? 0, m.dc12 ?? 0);
        const call = best === m.dc1x ? "1X" : best === (m.dcx2 ?? 0) ? "X2" : "12";
        out.push({ p, detail: `1X ${m.dc1x}% · X2 ${m.dcx2 ?? "—"}% · 12 ${m.dc12 ?? "—"}%`, call, tag: best, edge: null });
      } else if (mkt === "dnb") {
        if (m?.dnbH == null) continue;
        out.push({ p, detail: `Home ${m.dnbH}% / Away ${m.dnbA ?? "—"}%`, call: m.dnbH >= (m.dnbA ?? 0) ? p.home : p.away, tag: Math.max(m.dnbH, m.dnbA ?? 0), edge: null });
      } else if (mkt === "ht") {
        if (!p.ht) continue;
        const best = Math.max(...p.ht);
        const call = best === p.ht[0] ? "1 (Home)" : best === p.ht[1] ? "X (Draw)" : "2 (Away)";
        out.push({ p, detail: `1 ${p.ht[0]}% · X ${p.ht[1]}% · 2 ${p.ht[2]}%`, call, tag: best, edge: null });
      } else if (mkt === "htft") {
        if (!p.htft) continue;
        out.push({ p, detail: `${p.htft.combo} — ${p.htft.p}%`, call: p.htft.combo, tag: p.htft.p, edge: null });
      }
    }
    return out.sort((a, b) => (b.tag ?? 0) - (a.tag ?? 0));
  }, [items, mkt]);

  const withData = rows.length > 0;

  return (
    <div className="mkt-board">
      <div className="filter-tabs" role="tablist" aria-label="Market boards">
        {MKTS.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={mkt === x.key}
            className={`filter-tab ${mkt === x.key ? "active" : ""}`}
            onClick={() => setMkt(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p className="board-intro">
        Every game on today&rsquo;s football board, ranked by confidence for <b>{MKTS.find((x) => x.key === mkt)?.label}</b>.
        Green = the side we expect. Percentages are model estimates, not guarantees.
      </p>
      {withData ? (
        <div className="board-scroll">
          <table className="mkt-table board-table">
            <thead>
              <tr>
                <th>Time (WAT)</th>
                <th>Match</th>
                <th>Model says</th>
                <th>Our call</th>
                <th>Edge</th>
                <th>Tag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, detail, call, tag, edge }) => (
                <tr key={p.id}>
                  <td className="board-time">{String(p.t || "").replace(/^\d{1,2}\/\d{1,2}\s+/, "") || "TBD"}</td>
                  <td className="board-match">
                    {p.home} <em>v</em> {p.away}
                    <span className="board-league">{p.league}</span>
                  </td>
                  <td className="mkt-detail">{detail}</td>
                  <td className="mkt-call">{call}</td>
                  <td className={edge != null && edge >= 0 ? "edge-pos" : "edge-neg"}>
                    {edge == null ? "—" : `${edge >= 0 ? "+" : ""}${edge}pp`}
                  </td>
                  <td>{mktTagLike(tag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="callout callout-blue">
          No model numbers for this market on today&rsquo;s board yet — they land with the 06:00 WAT data drop.
        </div>
      )}
    </div>
  );
}
