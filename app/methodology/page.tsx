import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — How OddsOracle Picks Are Made",
  description:
    "Exactly how OddsOracle predictions are built: data sources, the model, what the percentages mean, how value is calculated, and how the track record is kept honest.",
  alternates: { canonical: "/methodology/" },
};

const PIPELINE = [
  { n: "1", t: "Data sources", d: "Daily boards (Forebet), bookmaker prices (350+ books via OddsPapi), ESPN official results, our own season-stats model." },
  { n: "2", t: "Validation", d: "Prices older than the board date, or deviating >20pp from the model, are flagged untrusted and can never earn a STRONG call." },
  { n: "3", t: "Poisson fit", d: "Each match gets expected goals (λ home / λ away) fitted to the model's published probabilities — one honest generator for everything below." },
  { n: "4", t: "Monte Carlo", d: "10,000 simulated matches per game → distributions for 1X2, O/U, BTTS, half-time and top scores (deterministic seed, reproducible)." },
  { n: "5", t: "Multi-model", d: "Independent engines: Poisson, Market (price, vig removed), Forebet board, Form (last-5). Agreement is counted, e.g. “3/3 agree”." },
  { n: "6", t: "Value engine", d: "Model chance vs market chance per market → edge (pp) and expected value (EV %). The signal: STRONG VALUE / VALUE / FAIR / NO EDGE / AVOID / PASS." },
  { n: "7", t: "Oracle Score", d: "0–100 analytical signal = edge strength (40) + confidence (20) + engine agreement (20) + data quality (20). Not a win probability." },
  { n: "8", t: "Publish + settle", d: "Timestamped prediction records (oracle-vX.Y), scored against official results, settled with odds → ROI, units, drawdown, calibration. Never edited." },
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
            <h2>The ODDSORACLE Engine (v2.0)</h2>
            <p>
              Every football card is scored by <b>oracle-v2.0</b>, a small but honest stack: a
              Poisson goal model fitted to our published probabilities, a 10,000-scene Monte Carlo
              simulation, the bookmaker&rsquo;s price (vig removed), Forebet&rsquo;s board, and a
              last-5 form read. Each engine votes; we publish which side each engine backed and how
              many agreed.
            </p>
            <p>
              <b>Signals, in plain words:</b> <b>💎 VALUE</b> = the model sees a meaningfully bigger
              chance than the price implies (edge ≥ 4 points). <b>💎💎 STRONG VALUE</b> = edge ≥ 8
              points <i>and</i> the price is fresh and sane. <b>⚖️ FAIR</b> = small edge, nothing
              special. <b>⏸ PASS</b> = we looked and there is no edge — the engine declines the
              match instead of forcing a pick. <b>🚫 AVOID</b> = the price is against us. A PASS is
              a feature: it is the engine doing its job, not a missed opportunity.
            </p>
            <p>
              <b>Oracle Score (0–100)</b> is an analytical signal, built from four named parts:
              edge strength (max 40), model confidence (20), engine agreement (20) and data
              quality (20). It deliberately is <b>not</b> “chance of winning” — a high score means
              “the evidence lines up”, never “this will hit”.
            </p>
            <p>
              <b>Price validation (no fake precision):</b> if the available price is from a previous
              day or deviates more than 20 points from the model&rsquo;s favourite, it is labelled
              untrusted under the card and capped at VALUE — a stale number can never manufacture a
              strong signal.
            </p>
            <p>
              <b>Versioning:</b> every prediction record carries its engine version (currently
              oracle-v2.0) and timestamp. When the model changes, the track record lets us compare
              versions instead of arguing about “the model”.
            </p>

            <h2>What the numbers mean (in plain words)</h2>
            <p>
              When a card shows <b>58%</b>, it means: in a world where this exact match was
              played 100 times, we estimate this outcome happens about 58 times. It is a model
              estimate built from available data — <b>not a promise</b>. No model, human or
              machine, can know a single match in advance.
            </p>
            <p>
              <b>🏦 80%+ confidence</b> = the model gives the picked side at least 80% chance —
              the threshold that feeds the daily Safe 20/10/5 combos. That is a statistical label,
              like a weather forecast saying “very likely” — it means more than average, not
              certain.
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
              The engine runs on: <b>Forebet&rsquo;s public boards</b> (probabilities, scores,
              half-time, corners, cards and goalscorer boards — pulled fresh at 06:00 WAT),{" "}
              <b>bookmaker prices from 350+ books</b> (OddsPapi; refreshed 00:10 WAT),{" "}
              <b>ESPN&rsquo;s official results</b> (scoring + final-score stamps) and{" "}
              <b>our own season-stats Poisson model</b> (per-league team strengths, home advantage,
              recency-weighted form). Each pick shows which engine the final call followed.
            </p>
            <p>
              What we do <b>not</b> have yet, and will never fake: confirmed lineups, official
              injury reports, xG feeds and live in-play odds. Those need licensed data feeds
              (we are wiring them in). Until they are live, treat lineup-dependent games with
              extra caution — especially rotated squad games. The engine&rsquo;s data-quality
              label on each card tells you exactly how complete the inputs were.
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
