import Link from "next/link";
import type { Metadata } from "next";
import SNAPSHOT from "@/lib/data-snapshot.json";

export const revalidate = 600;
export const runtime = "nodejs";

function loadHistory(): any {
  return (SNAPSHOT.history as any) || { days: {}, cumulative: null };
}

export const metadata: Metadata = {
  title: "Track Record & Hit Rates — OddsOracle",
  description:
    "How the OddsOracle model actually performs: daily and cumulative hit rates for match winner, over/under 2.5 and both teams to score, scored automatically against official results.",
};

function RateRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | null;
  sub?: string;
}) {
  return (
    <div className="mini-row">
      <div>
        <div className="mini-meta">{label}</div>
        <div className="mini-teams">{sub || ""}</div>
      </div>
      <div className="stat-n" style={{ fontSize: 24, fontWeight: 900 }}>
        {value == null ? "—" : `${value}%`}
      </div>
    </div>
  );
}

/** ✓ / ✗ / — cell for a single scored market. */
function WL({ won }: { won: number | null | undefined }) {
  if (won == null) return <span className="wl wl-none">—</span>;
  return won ? <span className="wl wl-win">✓</span> : <span className="wl wl-loss">✗</span>;
}

export default function TrackRecordPage() {
  const data = loadHistory();
  const c = data.cumulative;
  const days: Record<string, any> = (data.days || {}) as Record<string, any>;

  // Flat, newest-first list of every scored pick (the permanent audit trail).
  const audit = (c ? Object.entries(days) : [])
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .flatMap(([d, v]) => (v.rows || []).map((r: any) => ({ date: d, ...r })))
    .slice(0, 48);

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> / Track Record
          </div>
          <span className="eyebrow">Receipts, not promises</span>
          <h1>
            Our <span className="grad-text">track record</span>
          </h1>
          <p className="section-sub">
            Every pick is scored automatically against official results each
            night. No cherry-picking, no deleted losses — the numbers below are
            what actually happened.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          {!c ? (
            <div className="cta">
              <h2>Scoring starts now</h2>
              <p className="section-sub" style={{ margin: "0 auto 14px" }}>
                The first full day of picks is in play. Once tonight&rsquo;s
                results land, this page fills with real hit rates — day by day,
                market by market.
              </p>
              <Link className="btn btn-primary" href="/predictions/">
                See today&rsquo;s picks →
              </Link>
            </div>
          ) : (
            <>
              <div className="stats-band" style={{ marginBottom: 16 }}>
                <div className="statbox">
                  <div className="n">{c.matches}</div>
                  <div className="l">predictions settled</div>
                </div>
                <div className="statbox">
                  <div className="n">{c.days}</div>
                  <div className="l">days tracked</div>
                </div>
                <div className="statbox">
                  <div className="n" style={{ color: "var(--accent)" }}>
                    {c.model_1x2 != null ? `${c.model_1x2}%` : "—"}
                  </div>
                  <div className="l">model · match winner</div>
                </div>
                <div className="statbox">
                  <div className="n" style={{ color: "var(--accent-2)" }}>
                    {c.model_over25 != null ? `${c.model_over25}%` : "—"}
                  </div>
                  <div className="l">model · over 2.5 goals</div>
                </div>
                <div className="statbox">
                  <div className="n">{c.avg_odds != null ? c.avg_odds : "—"}</div>
                  <div className="l">average price taken</div>
                </div>
              </div>

              <div className="stats-band" style={{ marginBottom: 20 }}>
                <div className="statbox">
                  <div className="n" style={{ color: c.profit_units >= 0 ? "var(--good, #059669)" : "var(--bad, #dc2626)" }}>
                    {c.profit_units != null ? `${c.profit_units >= 0 ? "+" : ""}${c.profit_units}u` : "—"}
                  </div>
                  <div className="l">profit (1 unit per pick)</div>
                </div>
                <div className="statbox">
                  <div className="n" style={{ color: c.roi_pct != null && c.roi_pct >= 0 ? "var(--good, #059669)" : "var(--bad, #dc2626)" }}>
                    {c.roi_pct != null ? `${c.roi_pct >= 0 ? "+" : ""}${c.roi_pct}%` : "—"}
                  </div>
                  <div className="l">ROI on staked units</div>
                </div>
                <div className="statbox">
                  <div className="n">{c.max_drawdown != null ? `${c.max_drawdown}u` : "—"}</div>
                  <div className="l">max drawdown (worst dip)</div>
                </div>
                <div className="statbox">
                  <div className="n" style={{ fontSize: 16, marginTop: 6 }}>oracle-v2.0</div>
                  <div className="l">engine version in record</div>
                </div>
              </div>

              {Array.isArray(c.calibration) && c.calibration.length > 0 && (
                <div className="hero-card" style={{ marginBottom: 36, padding: 18 }}>
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>Probability calibration</h3>
                  </div>
                  <p style={{ fontSize: 13, color: "#5b6272", marginTop: 0 }}>
                    If the model says 60%, then over many picks about 60% of them should win. This
                    is how we check our confidence is honest — the sample is still small, so read it
                    as direction, not verdict.
                  </p>
                  <div className="board-scroll" style={{ border: "1px solid var(--line, #d8dce6)", borderRadius: 10 }}>
                    <table className="mkt-table board-table">
                      <thead>
                        <tr>
                          <th>Predicted chance</th>
                          <th>Picks</th>
                          <th>Avg predicted</th>
                          <th>Actual hit rate</th>
                          <th>Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.calibration.map((b: any) => {
                          const gap = Math.round((b.actual - b.predicted) * 10) / 10;
                          return (
                            <tr key={b.bucket}>
                              <td className="board-time">{b.bucket}</td>
                              <td>{b.n}</td>
                              <td>{b.predicted}%</td>
                              <td><b>{b.actual}%</b></td>
                              <td className={gap >= 0 ? "edge-pos" : "edge-neg"}>
                                {gap >= 0 ? "+" : ""}{gap}pp {gap > 5 ? "(overconfident)" : gap < -5 ? "(underconfident)" : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="slip-note" style={{ marginTop: 8 }}>
                    Small early sample — buckets with fewer than ~10 picks bounce a lot. We publish
                    the gaps exactly as they are: over-performing and under-performing alike.
                    Losing picks are never deleted.
                  </p>
                </div>
              )}

              <div className="pred-grid">
                <div className="hero-card">
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>Market breakdown (cumulative)</h3>
                  </div>
                  <RateRow label="Model · 1X2 winner" value={c.model_1x2} />
                  <RateRow
                    label="Market favourite · 1X2"
                    value={c.market_1x2}
                    sub="what the bookmakers backed"
                  />
                  <RateRow label="Model · Over 2.5" value={c.model_over25} />
                  <RateRow label="Model · BTTS" value={c.model_btts} />
                </div>
                <div className="hero-card">
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>Last 14 days</h3>
                  </div>
                  {Object.entries(days)
                    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                    .slice(0, 14)
                    .map(([d, v]) => (
                      <div className="mini-row" key={d}>
                        <div>
                          <div className="mini-meta">{d}</div>
                          <div className="mini-teams">
                            {v.stats.played} matches scored
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div className="mini-tip" style={{ color: "var(--accent)" }}>
                            1X2 {v.stats.model_1x2 != null ? `${v.stats.model_1x2}%` : "—"}
                          </div>
                          <div className="mini-tip" style={{ color: "var(--accent-2)" }}>
                            O2.5 {v.stats.model_over25 != null ? `${v.stats.model_over25}%` : "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {audit.length > 0 && (
                <div className="audit-wrap">
                  <div className="section-head">
                    <div>
                      <span className="eyebrow">The raw audit trail</span>
                      <h2 className="section-title" style={{ fontSize: 26 }}>
                        Every scored pick
                      </h2>
                      <p className="section-sub">
                        Newest first. Published before the event, scored after — never edited.
                      </p>
                    </div>
                  </div>
                  <div className="audit-scroll">
                    <table className="audit-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Match</th>
                          <th>Score</th>
                          <th>Model 1X2</th>
                          <th>Model O2.5</th>
                          <th>Model BTTS</th>
                          <th>Market 1X2</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.map((r, i) => (
                          <tr key={i}>
                            <td className="audit-date">{r.date}</td>
                            <td className="audit-match">{r.match}</td>
                            <td className="audit-score">{r.score}</td>
                            <td>
                              {r.model_pick} <WL won={r.model_win} />
                            </td>
                            <td>
                              <WL won={r.model_over25_win} />
                            </td>
                            <td>
                              <WL won={r.model_btts_win} />
                            </td>
                            <td>
                              {r.market_pick ? `${r.market_pick} ` : ""}
                              <WL won={r.market_win} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
