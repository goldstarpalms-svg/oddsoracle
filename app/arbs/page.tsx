import Link from "next/link";
import type { Metadata } from "next";
import AdSlot from "@/components/AdSlot";
import { loadPulseArbs } from "@/lib/localData";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Arbitrage Scanner — Cross-Book Surebet Finder",
  description:
    "A free arbitrage scanner: we compare the best 1X2 prices across 25+ bookmakers for every fixture on the board and flag the ones where backing all three outcomes returns a guaranteed profit.",
  alternates: { canonical: "/arbs/" },
  openGraph: {
    title: "Free Arbitrage Scanner — cross-book surebets",
    description:
      "Compare the best prices across 25+ bookmakers and see which fixtures are in arbitrage right now, plus the near-arbs worth watching.",
  },
};

export default function ArbsPage() {
  const doc = loadPulseArbs();
  const arbs = doc?.arbs || [];
  const watch = doc?.watch || [];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Arbitrage</span>
          </div>
          <span className="eyebrow">
            {doc ? `scanned ${doc.date} · 25+ bookmakers · 18+` : "awaiting first scan · 18+"}
          </span>
          <h1>
            Arbitrage <span className="grad-text">Scanner</span>
          </h1>
          <p className="section-sub">
            When the best price on the home win, the draw and the away win come from three different
            bookmakers and their implied probabilities add up to less than 100%, backing all three
            pays out more than you staked — whatever happens. We scan every fixture on today&rsquo;s
            board for exactly that.
          </p>

          <div className="pulse-stats">
            <div className="pulse-stat">
              <span className="pulse-stat-k">Live arbs</span>
              <span className="pulse-stat-v">{arbs.length}</span>
            </div>
            <div className="pulse-stat">
              <span className="pulse-stat-k">Near-arbs watched</span>
              <span className="pulse-stat-v">{watch.length}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Live</span>
              <h2 className="section-title" style={{ fontSize: 28 }}>
                Surebets on the board right now
              </h2>
              <p className="section-sub">
                {arbs.length
                  ? "Stake the percentage shown on each leg. The return is the same whichever outcome lands."
                  : "No fixture is in true arbitrage at this moment. It happens a few times a week, not every hour — the watchlist below is where they appear first."}
              </p>
            </div>
          </div>

          {arbs.map((a) => (
            <div className="arb-card" key={a.event}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontSize: 17 }}>{a.event}</strong>
                <span style={{ color: "#37d69b", fontWeight: 800, fontSize: 18 }}>
                  +{a.profit_pct.toFixed(2)}% risk-free
                </span>
              </div>
              {a.legs.map((l) => (
                <div className="arb-leg" key={l.selection}>
                  <span>
                    {l.selection} · <span style={{ color: "#93a3c4" }}>{l.book || "book"}</span>
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    @{l.price.toFixed(2)} · stake {l.stake_pct?.toFixed(1)}%
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 12, color: "#7f8fae" }}>
                Margin {((a.margin ?? 0) * 100).toFixed(2)}% · source: {a.source}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="container">
        <AdSlot size="Leaderboard (728x90)" />
      </div>

      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Watchlist</span>
              <h2 className="section-title" style={{ fontSize: 26 }}>
                Near-arbs — within 2% of locking in
              </h2>
              <p className="section-sub">
                These are not profitable yet. They are the fixtures where one book drifting turns a
                thin overround into a real arb, so they are the ones worth keeping an eye on.
              </p>
            </div>
          </div>

          <div className="pred-grid">
            {watch.slice(0, 24).map((w) => (
              <article className="pred-card" key={w.event}>
                <div className="pred-top">
                  <span className="league">{w.gap_pct.toFixed(2)}% away</span>
                  <span className="kickoff">overround {w.overround.toFixed(4)}</span>
                </div>
                <div className="pred-teams">
                  <span className="pred-team">{w.home}</span>
                  <span className="pred-vs">vs</span>
                  <span className="pred-team">{w.away}</span>
                </div>
                <div className="pulse-probs" style={{ marginTop: 10 }}>
                  {w.legs.map((l) => (
                    <span className="pulse-prob" key={l.selection}>
                      <span className="pulse-prob-label">{l.selection}</span>
                      <span className="pulse-prob-nums">@{l.price.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
                <p className="analysis" style={{ marginTop: 8 }}>
                  Best prices: {w.legs.map((l) => `${l.selection} @${l.price.toFixed(2)} (${l.book})`).join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>How to actually use these</h2>
          <p>
            An arb is only real while the prices are. Always open all three books and confirm the
            price before you stake — odds move, and a leg that has already drifted can turn a
            guaranteed profit into an ordinary bet. Start small until you trust your own routine;
            the hard part is execution speed, not the maths.
          </p>
          <div className="callout">
            {doc?.disclaimer ||
              "Prices come from OddsChecker (UK bookmakers). Confirm every price on the book before staking."}{" "}
            Bookmakers also reserve the right to void or limit bets they consider to be arbitrage —
            this is a tool, not a salary. 18+ only, and never stake money you cannot afford to lose.
          </div>
          <p style={{ marginTop: 14 }}>
            Prefer value betting to surebets? The <Link href="/pulse/">Pulse-Bet board</Link> ranks
            every fixture by expected value instead.
          </p>
        </div>
      </section>
    </>
  );
}
