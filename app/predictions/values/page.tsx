import Link from "next/link";
import type { Metadata } from "next";
import SNAPSHOT from "@/lib/data-snapshot.json";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Value Bets Today — Where the Price Looks Generous",
  description:
    "Every football game where our model sees a bigger chance than the bookmakers' price implies — model % vs market %, edge in points, best price. Updated with the daily data drop.",
};

type Row = {
  t: string;
  home: string;
  away: string;
  lg: string;
  pick: string;
  modelPct: number;
  mktPct: number;
  edge: number;
  odds: number | null;
  fbPct: number | null;
};

export default function ValuesPage() {
  const rows = (SNAPSHOT.football as any[]) || [];
  const out: Row[] = [];
  for (const r of rows) {
    if (!r || !r.home || !r.away) continue;
    const k1 = r.final === "1" ? 0 : r.final === "2" ? 2 : 1;
    const mktDec = Array.isArray(r.mkt_dec) ? r.mkt_dec[k1] : typeof r.mkt_dec === "number" ? r.mkt_dec : null;
    if (typeof mktDec !== "number" || mktDec <= 1) continue; // need a real bookmaker price
    const modelPct = Array.isArray(r.model?.p) ? r.model.p[k1] : Array.isArray(r.fb_pct) ? r.fb_pct[k1] : null;
    if (modelPct == null) continue;
    const mktPct = Math.round(100 / mktDec);
    const edge = Math.round(modelPct - mktPct);
    if (edge < 1) continue; // only where the price looks generous
    out.push({
      t: String(r.t || "").replace(/^\d{1,2}\/\d{1,2}\s+/, ""),
      home: r.home,
      away: r.away,
      lg: r.lg || "Football",
      pick: r.final,
      modelPct,
      mktPct,
      edge,
      odds: Math.round(mktDec * 100) / 100,
      fbPct: Array.isArray(r.fb_pct) ? r.fb_pct[k1] : null,
    });
  }
  out.sort((a, b) => b.edge - a.edge || b.modelPct - a.modelPct);
  const top = out.slice(0, 25);
  const safe = top.filter((x) => x.modelPct >= 70);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">
            <Link href="/predictions/football">Football</Link> · Value bets
          </p>
          <h1>💎 Value bets — today</h1>
          <p className="page-sub">
            “Value” = our model sees a bigger chance than the bookmakers&rsquo; price implies. Example: the
            price says 40% but the model says 52% → that&rsquo;s a <b>+12 point edge</b>. No edge, no list.
            These are statistical reads, not guarantees — stake small.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          {safe.length > 0 && (
            <div className="callout callout-green" style={{ marginBottom: 14 }}>
              🏦 <b>Safe values:</b> {safe.length} game{safe.length > 1 ? "s" : ""} where the model is at 70%+
              AND the price still looks generous — {safe.map((x) => x.home).join(", ")}.
            </div>
          )}
          {top.length === 0 ? (
            <div className="callout callout-blue">
              No positive edges right now — the prices are in line with the model. New values land with
              the 06:00 WAT data drop and the 00:10 WAT price refresh.
            </div>
          ) : (
            <div className="board-scroll" style={{ border: "1px solid var(--line, #d8dce6)", borderRadius: 12 }}>
              <table className="mkt-table board-table">
                <thead>
                  <tr>
                    <th>Time (WAT)</th>
                    <th>Match</th>
                    <th>Our pick</th>
                    <th>Model says</th>
                    <th>Market says</th>
                    <th>Edge</th>
                    <th>Best price</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((x, i) => (
                    <tr key={i}>
                      <td className="board-time">{x.t || "TBD"}</td>
                      <td className="board-match">
                        {x.home} <em>v</em> {x.away}
                        <span className="board-league">{x.lg}</span>
                      </td>
                      <td className="mkt-call">
                        {x.pick}
                        {x.pick === "1" ? ` (${x.home})` : x.pick === "2" ? ` (${x.away})` : " (Draw)"}
                      </td>
                      <td className="mkt-detail">
                        {x.modelPct}%
                        {x.fbPct != null ? ` (model ${x.fbPct}%)` : ""}
                      </td>
                      <td className="mkt-detail">~{x.mktPct}%</td>
                      <td className="edge-pos">+{x.edge}pp</td>
                      <td className="mkt-call">@{x.odds?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="slip-note" style={{ marginTop: 12 }}>
            Edge = model chance − price-implied chance (points). The market prices in a margin (the
            “vig”), so small edges are normal. We only list games where the model beats the price — the
            honest way to find the prices worth considering. 18+
          </p>
        </div>
      </section>
    </>
  );
}
