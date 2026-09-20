"use client";

import { useMemo } from "react";
import SNAPSHOT from "@/lib/data-snapshot.json";
import GameGate from "./GameGate";

interface Ev {
  home: string;
  away: string;
  start: string | null;
  h2h: Record<string, { home: number | null; away: number | null }>;
  totals: Record<string, { line: number | null; over: number | null; under: number | null }>;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Lagos",
  });

export default function MlbBoard() {
  const events = useMemo(() => {
    const s = (SNAPSHOT as any).odds?.sports?.baseball_mlb;
    const list: (Ev & {
      bh: [string, number] | null;
      ba: [string, number] | null;
      mainLine: number | null;
      bo: number | null;
      bu: number | null;
      nBooks: number;
    })[] = [];
    for (const e of s?.events || []) {
      let bh: [string, number] | null = null;
      let ba: [string, number] | null = null;
      for (const [bk, v] of Object.entries<any>(e.h2h || {})) {
        if (typeof v.home === "number" && v.home > 1 && (!bh || v.home > bh[1])) bh = [bk, v.home];
        if (typeof v.away === "number" && v.away > 1 && (!ba || v.away > ba[1])) ba = [bk, v.away];
      }
      const lineCount: Record<number, number> = {};
      for (const v of Object.values<any>(e.totals || {}))
        if (typeof v.line === "number") lineCount[v.line] = (lineCount[v.line] || 0) + 1;
      const mainLine =
        Object.entries(lineCount)
          .map(([k, v]) => [Number(k), v] as [number, number])
          .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      let bo: number | null = null;
      let bu: number | null = null;
      for (const v of Object.values<any>(e.totals || {})) {
        if (v.line !== mainLine) continue;
        if (typeof v.over === "number" && v.over > 1 && (bo == null || v.over > bo)) bo = v.over;
        if (typeof v.under === "number" && v.under > 1 && (bu == null || v.under > bu)) bu = v.under;
      }
      list.push({
        home: e.home,
        away: e.away,
        start: e.start,
        h2h: e.h2h || {},
        totals: e.totals || {},
        bh,
        ba,
        mainLine,
        bo,
        bu,
        nBooks: Object.keys(e.h2h || {}).length,
      });
    }
    return list.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  }, []);

  return (
    <div>
      <div className="callout callout-blue">
        ⚾ <b>MLB is live on this board</b> — {events.length} games with real bookmaker prices.
        💰 marks the best price on each side. Times are WAT.
      </div>
      <div className="odds-list" style={{ marginTop: 14 }}>
        {events.map((e, i) => (
          <GameGate key={i} iso={e.start} sport="baseball" final={(e as any).final} icon="⚾">
            <div className="odds-card">
            <div className="odds-card-head" style={{ cursor: "default" }}>
              <span className="odds-card-match">
                {e.home} <em>vs</em> {e.away}
              </span>
              <span className="odds-card-time">
                {e.start ? `${fmt(e.start)} WAT` : ""}
                {e.nBooks > 0 ? ` · ${e.nBooks} bookies` : ""}
              </span>
            </div>
            <div className="odds-card-best">
              <div className="odds-best-col">
                <span>{e.home}</span>
                {e.bh ? <b className="odds-hot">💰 @{e.bh[1].toFixed(2)}</b> : <b>—</b>}
              </div>
              <div className="odds-best-col">
                <span>{e.mainLine != null ? `Total ${e.mainLine}` : "Totals"}</span>
                {e.bo != null ? (
                  <>
                    <b>O {e.bo.toFixed(2)}</b>
                    {e.bu != null && <b> &nbsp;U {e.bu.toFixed(2)}</b>}
                  </>
                ) : (
                  <b>—</b>
                )}
              </div>
              <div className="odds-best-col">
                <span>{e.away}</span>
                {e.ba ? <b className="odds-hot">💰 @{e.ba[1].toFixed(2)}</b> : <b>—</b>}
              </div>
            </div>
            </div>
          </GameGate>
        ))}
        {events.length === 0 && (
          <div className="callout callout-blue">No MLB games on the board right now.</div>
        )}
      </div>
      <div style={{ marginTop: 18 }}>
        <div className="callout">
          🏈 <b>NFL:</b> no games today. Week 1 opens Friday 25/9 — the board fills the same day
          the schedule is priced.
        </div>
        <div className="callout" style={{ marginTop: 8 }}>
          🏈 <b>NCAA American football:</b> the full slate is right below this MLB board, with
          Forebet&rsquo;s 1/2 split, pick and score call on every game.
        </div>
      </div>
    </div>
  );
}
