import Link from "next/link";
import type { Metadata } from "next";
import SNAPSHOT from "@/lib/data-snapshot.json";
import {
  cumulative,
  windows,
  plCurve,
  skillScores,
  byMarket,
  bySport,
  auditRows,
} from "@/lib/trackstats";

export const revalidate = 600;
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Track Record 2.0 — OddsOracle",
  description:
    "The full track record: hit rates, ROI, profit curve, drawdown, calibration, Brier score and log loss — every window, every market, sample sizes shown. Losses are never deleted.",
};

function WL({ won }: { won: number | null | undefined }) {
  if (won == null) return <span className="wl wl-none">—</span>;
  return won ? <span className="wl wl-win">✓</span> : <span className="wl wl-loss">✗</span>;
}

/** Small SVG profit curve (cumulative units). */
function PlCurve({ points, maxDD }: { points: { x: number; y: number; date: string }[]; maxDD: number }) {
  const W = 640, H = 180, P = 28;
  if (points.length < 2) return null;
  const ys = points.map((p) => p.y);
  const min = Math.min(0, ...ys) - 2;
  const max = Math.max(0, ...ys) + 2;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-svg" role="img" aria-label="Cumulative profit curve in units">
      <line x1={P} y1={zeroY} x2={W - P} y2={zeroY} stroke="var(--border, #1e2a42)" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="var(--accent, #1fd68b)" strokeWidth="2.5" strokeLinejoin="round" />
      {last.y >= 0 ? (
        <text x={W - P} y={y(last.y) - 8} textAnchor="end" className="pl-end">+{last.y}u</text>
      ) : (
        <text x={W - P} y={y(last.y) - 8} textAnchor="end" className="pl-end">{last.y}u</text>
      )}
      <text x={P} y={16} className="pl-lbl">profit, units (1 unit = stake per pick)</text>
      <text x={W - P} y={H - 8} textAnchor="end" className="pl-lbl">
        n={last.x} settled money picks · max drawdown {maxDD}u
      </text>
    </svg>
  );
}

/** Calibration curve: diagonal (perfect) + bucket points. */
function CalibCurve({ cal }: { cal: { bucket: string; n: number; predicted: number; actual: number }[] }) {
  const W = 640, H = 260, P = 34;
  const x = (v: number) => P + (v / 100) * (W - 2 * P);
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pl-svg" role="img" aria-label="Calibration curve">
      <line x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} stroke="var(--text-faint, #6b7a92)" strokeDasharray="5 5" />
      <text x={x(100) - 4} y={y(100) - 6} textAnchor="end" className="pl-lbl">perfect calibration</text>
      <text x={P - 6} y={y(100) + 4} textAnchor="end" className="pl-lbl">0%</text>
      <text x={P - 6} y={y(0) + 4} textAnchor="end" className="pl-lbl">100%</text>
      <text x={x(0)} y={H - 10} className="pl-lbl">predicted ←</text>
      <text x={W - P} y={H - 10} textAnchor="end" className="pl-lbl">→ actual</text>
      {cal.map((b) => (
        <g key={b.bucket}>
          <circle cx={x(b.predicted)} cy={y(b.actual)} r={4 + Math.min(6, b.n / 3)} className="cal-dot" opacity={0.85} />
          <text x={x(b.predicted)} y={y(b.actual) - 10} textAnchor="middle" className="cal-txt">{b.n}</text>
        </g>
      ))}
    </svg>
  );
}

export default function TrackRecordPage() {
  const c = cumulative();
  const wins = windows();
  const pl = plCurve();
  const skill = skillScores();
  const markets = byMarket();
  const sports = bySport();
  const audit = auditRows();
  const days: Record<string, any> = ((SNAPSHOT as any).history?.days) || {};

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> / Track Record
          </div>
          <span className="eyebrow">Receipts, not promises</span>
          <h1>
            Our <span className="grad-text">track record</span>, all of it
          </h1>
          <p className="section-sub">
            Every pick is scored automatically against official results. No cherry-picking, no
            deleted losses, no small-sample bragging — the sample size sits right next to every
            number.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          {!c ? (
            <div className="cta">
              <h2>Scoring starts now</h2>
              <p className="section-sub" style={{ margin: "0 auto 14px" }}>
                Once the first settled results land, this page fills with real hit rates — day by
                day, market by market.
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
                  <div className="n">
                    {c.model_1x2 != null ? `${c.model_1x2}%` : "—"}
                    <small style={{ fontSize: 12, color: "var(--text-faint)" }}> n={wins.find((w) => w.key === "all")?.wins}/{c.matches}</small>
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
              </div>

              {/* WINDOWS */}
              <div className="hero-card" style={{ marginBottom: 24, padding: 18 }}>
                <div className="hero-card-head">
                  <h3 style={{ margin: 0 }}>By window</h3>
                </div>
                <div className="board-scroll">
                  <table className="mkt-table board-table">
                    <thead>
                      <tr>
                        <th>Window</th>
                        <th>Settled</th>
                        <th>W–L (1X2)</th>
                        <th>Hit rate</th>
                        <th>Units</th>
                        <th>ROI</th>
                        <th>Avg odds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wins.map((w) => (
                        <tr key={w.key}>
                          <td className="board-time">{w.label}</td>
                          <td>{w.settled}</td>
                          <td>{w.wins}–{w.losses}</td>
                          <td>{w.hitRate != null ? `${w.hitRate}%` : "—"}</td>
                          <td>
                            {w.units != null ? (
                              <span style={{ color: w.units >= 0 ? "var(--good, #059669)" : "var(--bad, #dc2626)" }}>
                                {w.units >= 0 ? "+" : ""}{w.units}u
                              </span>
                            ) : ("—")}
                          </td>
                          <td>
                            {w.roi != null ? (
                              <span style={{ color: w.roi >= 0 ? "var(--good, #059669)" : "var(--bad, #dc2626)" }}>
                                {w.roi >= 0 ? "+" : ""}{w.roi}%
                              </span>
                            ) : ("—")}
                          </td>
                          <td>{w.avgOdds != null ? w.avgOdds : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="slip-note" style={{ marginTop: 8 }}>
                  Windows recompute from the settled rows on every build. Early windows are small
                  samples — read them as direction, not verdict. US sports without prices
                  (e.g. college football) count for hit rate, not units. Engine version in record:{" "}
                  <b>v{String((SNAPSHOT.football as any)?.[0]?.oracle?.model_version || "—").split("-")[0]}</b>.
                </p>
              </div>

              {/* P/L CURVE */}
              {pl.points.length > 1 && (
                <div className="hero-card" style={{ marginBottom: 24, padding: 18 }}>
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>Profit &amp; loss curve</h3>
                  </div>
                  <PlCurve points={pl.points} maxDD={c.max_drawdown ?? pl.maxDD} />
                  <p className="slip-note" style={{ marginTop: 6 }}>
                    One unit staked on every priced 1X2 call, oldest to newest. The dip between
                    peaks is the drawdown ({c.max_drawdown ?? pl.maxDD}u worst case) — shown because
                    flat is never going to be true.
                  </p>
                </div>
              )}

              {/* CALIBRATION */}
              {Array.isArray(c.calibration) && c.calibration.length > 0 && (
                <div className="hero-card" style={{ marginBottom: 24, padding: 18 }}>
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>Probability calibration</h3>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0 }}>
                    If the model says 60%, then over many picks about 60% of them should win.
                    Dots sit where each bucket&rsquo;s actual hit rate landed; the dashed line is
                    perfect. Dot size = sample size.
                  </p>
                  <CalibCurve cal={c.calibration as { bucket: string; n: number; predicted: number; actual: number }[]} />
                  <div className="board-scroll" style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
                    <table className="mkt-table board-table">
                      <thead>
                        <tr>
                          <th>Predicted chance</th>
                          <th>Picks (n)</th>
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
                    Small early sample — buckets with fewer than ~10 picks bounce a lot. The gaps
                    are published exactly as they are: over-performing and under-performing alike.
                  </p>
                </div>
              )}

              {/* SKILL SCORES */}
              <div className="hero-card" style={{ marginBottom: 24, padding: 18 }}>
                <div className="hero-card-head">
                  <h3 style={{ margin: 0 }}>Skill scores (1X2, n={skill.n})</h3>
                </div>
                <div className="board-scroll">
                  <table className="mkt-table board-table">
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>Value</th>
                        <th>Reference</th>
                        <th>Plain English</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="board-time">Brier score</td>
                        <td><b>{skill.brier ?? "—"}</b></td>
                        <td>0 = perfect · 0.25 = coin flip</td>
                        <td>Lower is better — overall accuracy of the probability, win or lose.</td>
                      </tr>
                      <tr>
                        <td className="board-time">Log loss</td>
                        <td><b>{skill.logloss ?? "—"}</b></td>
                        <td>{skill.baseline.toFixed(4)} = always 50/50</td>
                        <td>Lower is better — punishes confident misses harder than unsure hits.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="slip-note" style={{ marginTop: 8 }}>
                  {skill.logloss != null && skill.logloss < skill.baseline
                    ? `At ${skill.logloss} we beat the 50/50 baseline (${skill.baseline.toFixed(4)}) on ${skill.n} settled calls — real skill, small sample.`
                    : `At ${skill.logloss ?? "—"} vs the 50/50 baseline (${skill.baseline.toFixed(4)}) on ${skill.n} settled calls — an honest read while the sample is still small.`}
                </p>
              </div>

              <div className="pred-grid">
                <div className="hero-card">
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>By market (all-time)</h3>
                  </div>
                  {markets.map((m) => (
                    <div className="mini-row" key={m.label}>
                      <div>
                        <div className="mini-meta">{m.label}</div>
                        <div className="mini-teams">n={m.n}{m.roi != null ? ` · ROI ${m.roi >= 0 ? "+" : ""}${m.roi}%` : ""}</div>
                      </div>
                      <div className="stat-n" style={{ fontSize: 22, fontWeight: 900 }}>
                        {m.hitRate != null ? `${m.hitRate}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hero-card">
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>By sport</h3>
                  </div>
                  {sports.map((s) => (
                    <div className="mini-row" key={s.sport}>
                      <div>
                        <div className="mini-meta">{s.sport}</div>
                        <div className="mini-teams">
                          {s.wins}W–{s.losses}L
                          {s.units != null ? ` · ${s.units >= 0 ? "+" : ""}${s.units}u` : " · win-rate only (no prices)"}
                        </div>
                      </div>
                      <div className="stat-n" style={{ fontSize: 22, fontWeight: 900 }}>
                        {s.hitRate != null ? `${s.hitRate}%` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hero-card">
                  <div className="hero-card-head">
                    <h3 style={{ margin: 0 }}>Daily</h3>
                  </div>
                  {Object.entries(days)
                    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
                    .slice(0, 14)
                    .map(([d, v]) => (
                      <div className="mini-row" key={d}>
                        <div>
                          <div className="mini-meta">{d}</div>
                          <div className="mini-teams">{v.stats.played} matches scored</div>
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
                        Every scored pick ({audit.length})
                      </h2>
                      <p className="section-sub">
                        Newest first. Published before the event, scored after — never edited,
                        never deleted.
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
