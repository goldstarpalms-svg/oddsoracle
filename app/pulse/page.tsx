import Link from "next/link";
import type { Metadata } from "next";
import PulseBoard from "@/components/PulseBoard";
import AdSlot from "@/components/AdSlot";
import { loadPulseDoc, loadPulsePicks } from "@/lib/localData";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Pulse-Bet Board — Model Probability, EV & Kelly Stakes",
  description:
    "Every pick on today's board scored by the Pulse-Bet engine: Dixon-Coles model probability blended with Forebet and the devigged market, EV against the best book price, ELITE/STRONG/GOOD tier and a fractional-Kelly stake.",
  alternates: { canonical: "/pulse/" },
  openGraph: {
    title: "Pulse-Bet Board — probability, EV and Kelly staking",
    description:
      "Forebet supplies the volume, Pulse-Bet supplies the edge: calibrated probabilities, expected value and honest staking on today's football, basketball and tennis.",
  },
};

export default function PulsePage() {
  const doc = loadPulseDoc();
  const picks = loadPulsePicks();
  const bettable = picks.filter((p) => p.bettable);
  const ev = picks
    .filter((p) => p.ev_flag)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const fb = picks.filter((p) => p.sport === "football");
  const cov = doc?.coverage || {};

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Pulse Board</span>
          </div>
          <span className="eyebrow">
            {doc ? `data ${doc.date} · ${doc.model_version} · 18+` : "awaiting first export · 18+"}
          </span>
          <h1>
            The <span className="grad-text">Pulse-Bet</span> Board
          </h1>
          <p className="section-sub">
            Forebet gives us the volume — around a hundred fixtures a day. Pulse-Bet scores every
            one of them: a Dixon-Coles model trained on real league results, blended with Forebet
            and the devigged market, then priced against the best available book. What comes out is
            a probability, an expected value, a tier and a stake.
          </p>

          {doc && (
            <div className="pulse-stats">
              <div className="pulse-stat">
                <span className="pulse-stat-k">Fixtures scored</span>
                <span className="pulse-stat-v">{picks.length}</span>
              </div>
              <div className="pulse-stat">
                <span className="pulse-stat-k">Cleared the bar</span>
                <span className="pulse-stat-v">{bettable.length}</span>
              </div>
              <div className="pulse-stat">
                <span className="pulse-stat-k">+EV flagged</span>
                <span className="pulse-stat-v">{ev.length}</span>
              </div>
              <div className="pulse-stat">
                <span className="pulse-stat-k">With book prices</span>
                <span className="pulse-stat-v">{cov.priced ?? 0}</span>
              </div>
              <div className="pulse-stat">
                <span className="pulse-stat-k">Model covered</span>
                <span className="pulse-stat-v">{cov.modelled ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Tier 1</span>
              <h2 className="section-title" style={{ fontSize: 28 }}>
                Picks that cleared the bar
              </h2>
              <p className="section-sub">
                ELITE needs 70%+ probability and 8%+ EV. STRONG is 60% and 5%. GOOD is 50% and 3%.
                Anything below that is a SKIP — listed below for transparency, never staked.
              </p>
            </div>
            <Link href="/methodology/" className="btn btn-ghost">
              How the model works →
            </Link>
          </div>

          <PulseBoard
            picks={bettable}
            empty="No pick cleared the bar today. That is the engine doing its job — a quiet board beats a forced bet."
          />
        </div>
      </section>

      {ev.length > 0 && (
        <section className="sec">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">EV board</span>
                <h2 className="section-title" style={{ fontSize: 26 }}>
                  Best expected value on the board
                </h2>
                <p className="section-sub">
                  Ranked by EV regardless of tier. A 5%+ edge at long odds is still value — the
                  Kelly stake is what keeps the size sensible.
                </p>
              </div>
            </div>
            <PulseBoard picks={ev} limit={12} />
          </div>
        </section>
      )}

      <div className="container">
        <AdSlot size="Leaderboard (728x90)" />
      </div>

      {fb.length > 0 && (
        <section className="sec">
          <div className="container">
            <div className="section-head">
              <div>
                <span className="eyebrow">Football</span>
                <h2 className="section-title" style={{ fontSize: 26 }}>
                  Every football fixture we scored
                </h2>
                <p className="section-sub">
                  {fb.length} fixtures. Pulse&nbsp;DC is our model, Market is the devigged book
                  price, Forebet is the published percentage — Blend is what we actually bet against.
                </p>
              </div>
            </div>
            <PulseBoard picks={fb} />
          </div>
        </section>
      )}

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>What the tiers and stakes mean</h2>
          <p>
            Every card carries three probability columns. <strong>Pulse</strong> comes from a
            Dixon-Coles Poisson model fitted on football-data.co.uk results with time decay, so
            recent form counts for more. <strong>Market</strong> is the book price with the
            overround stripped out. <strong>Forebet</strong> is the published percentage where one
            exists. The blend weights all three, and the resulting number is compared with the best
            price we can find across 25+ bookmakers to give the EV.
          </p>
          <p>
            Stakes are fractional Kelly — a quarter of full Kelly, capped at 3% of a ₦100,000
            bankroll. A SKIP shows zero stake no matter how large the raw Kelly number, because the
            tier exists to keep you out of bad spots.
          </p>
          <div className="callout">
            If our model and the market disagree by more than 22 percentage points on any outcome,
            we drop the model component for that fixture and fall back to the market and Forebet.
            In practice that is a team-name mismatch — promoted sides, reserve teams, cup ties —
            and a mismatched team invents edge out of thin air. We would rather show you less than
            show you something false.
          </div>
          <p style={{ marginTop: 14 }}>
            Looking for risk-free edges instead? See the{" "}
            <Link href="/arbs/">arbitrage scanner</Link>. Want the raw numbers?{" "}
            <Link href="/api/pulse">/api/pulse</Link> serves the same data as JSON.
          </p>
        </div>
      </section>
    </>
  );
}
