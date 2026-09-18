import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

export const revalidate = 600;
export const runtime = "nodejs";

function loadHistory(): any {
  try {
    const p = path.join(process.cwd(), "backend", "app", "results", "history.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { days: {}, cumulative: null };
  }
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

export default function TrackRecordPage() {
  const data = loadHistory();
  const c = data.cumulative;
  const days: Record<string, any> = Object.entries(
    data.days || {}
  ) as Record<string, any>;

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
              <div className="stats-band" style={{ marginBottom: 36 }}>
                <div className="statbox">
                  <div className="n">{c.matches}</div>
                  <div className="l">matches scored</div>
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
              </div>

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
            </>
          )}
        </div>
      </section>
    </>
  );
}
