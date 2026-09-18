import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — How OddsOracle Picks Are Made",
  description:
    "Exactly how OddsOracle predictions are built: data sources, the model, what the percentages mean, how value is calculated, and how the track record is kept honest.",
  alternates: { canonical: "/methodology/" },
};

const PIPELINE = [
  { n: "1", t: "Fixtures", d: "Every game scheduled for the day, in WAT, across the leagues we cover." },
  { n: "2", t: "External model", d: "Forebet's own probabilities and predicted scores for each covered match." },
  { n: "3", t: "Our model", d: "A probability model on the same 1X2 / O2.5 / BTTS markets, from form and market data." },
  { n: "4", t: "Fusion", d: "Where both engines agree, the pick is flagged FUSION and gets extra weight." },
  { n: "5", t: "Probability", d: "One number per outcome: the chance we estimate it happens. Estimates, never promises." },
  { n: "6", t: "Value / edge", d: "Model chance compared with the market price. Bigger gap = more interesting price." },
  { n: "7", t: "Publish", d: "Timestamped, with the source of every number. Never edited after the fact." },
];

export default function MethodologyPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Methodology</span>
          </div>
          <span className="eyebrow">The receipts</span>
          <h1>
            How every pick is <span className="grad-text">made</span>
          </h1>
          <p className="section-sub">
            No black boxes. This page explains the pipeline, the labels and the rules we hold
            ourselves to — read it once and every page on the site makes sense.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          {/* PIPELINE */}
          <div className="method-pipeline">
            {PIPELINE.map((s) => (
              <div className="method-step" key={s.n}>
                <div className="n">{s.n}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>

          <div className="prose" style={{ maxWidth: 840 }}>
            <h2>What the numbers mean (in plain words)</h2>
            <p>
              When a card shows <b>58%</b>, it means: in a world where this exact match was
              played 100 times, we estimate this outcome happens about 58 times. It is a model
              estimate built from available data — <b>not a promise</b>. No model, human or
              machine, can know a single match in advance.
            </p>
            <p>
              <b>🏦 Banker / High confidence</b> = the model gives the picked side at least 70%
              chance. That is a statistical label, like a weather forecast saying “very likely” —
              it means more than average, not certain.
            </p>
            <p>
              <b>💎 Value</b> = the price looks generous for the risk. Example: our model says a
              team has a 59% chance, but the odds only price in about 41%. That 18-point gap is
              the “edge”. Edge is where long-term bettors make money — and where small samples
              still look random.
            </p>
            <p>
              <b>Model chance all hit</b> (in Slip Tools) multiplies the probabilities of every
              leg. Three legs at 80% × 72% × 66% ≈ 38%. That multiplication is why long
              accumulators lose so often.
            </p>

            <h2>Data sources, honestly</h2>
            <p>
              Right now the site runs on two engines: <b>Forebet&rsquo;s public probabilities and
              score predictions</b> (pulled fresh every morning) and <b>our own probability
              model</b>. Each pick shows which engine the final call followed. Predicted scores
              are the external model&rsquo;s, clearly labelled.
            </p>
            <p>
              What we do <b>not</b> have yet: confirmed lineups, official injury reports and live
              in-play odds. Those need licensed data feeds (we are wiring them in), and until
              they are live, treat “lineup-dependent” games with extra caution — especially
              rotated squad games.
            </p>

            <h2>The track record rules</h2>
            <ul>
              <li>Every pick is timestamped before the event starts.</li>
              <li>Results are scored automatically against official results each night.</li>
              <li>Losses are published exactly like wins. Nothing is deleted or reworded.</li>
              <li>Hit rates are shown per market and per day so you can judge the trend, not one lucky week.</li>
            </ul>

            <h2>The rules we never break</h2>
            <div className="callout">
              No guaranteed-win language, ever. Probabilities are estimates. Free picks are
              opinions with receipts. 18+ only — if betting stops being fun, stop, and see the{" "}
              <Link href="/responsible-gambling/">responsible gambling</Link> page.
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
