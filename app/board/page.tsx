import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { oracleBoardRows, summary, freshness, fmtDate } from "@/lib/rich";
import TerminalBoard from "@/components/TerminalBoard";
import { buildBoard } from "@/lib/board";
import FaqList from "@/components/FaqList";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Oracle Model Board",
  description:
    "The full Oracle Model Board: every scored event with model probability, market probability, edge, EV, Oracle Score, consensus and data quality — filtered, sorted and inspectable.",
  alternates: { canonical: `${SITE.url}/board/` },
};

const FAQ = [
  {
    q: "What is the Oracle Score?",
    a: "A 0–100 quality rating for each prediction, built from edge size, EV, model consensus, data quality and price freshness. It is deliberately NOT the chance of winning — that would be the model probability column, shown separately.",
  },
  {
    q: "Why do some high-confidence picks say PASS?",
    a: "Confidence is the model's belief in an outcome. Value is whether the price pays for it. If the model says 81% and the market implies 84.8%, the edge is negative and the engine says PASS — a certain-looking pick can still be a bad bet at that price.",
  },
  {
    q: "What do VALUE and STRONG VALUE mean?",
    a: "VALUE = the model probability is meaningfully higher than the market-implied probability (positive edge). STRONG VALUE = a larger edge with clean, fresh data. FAIR = price and model agree. PASS / NO EDGE = the engine declined. AVOID = negative edge on a price we trust.",
  },
  {
    q: "How fresh are the prices?",
    a: "Football prices are re-fetched through the night and at 06:00 WAT, then re-pulled from OddsChecker live feeds. Every row shows its own data timestamp, and the board header shows when the whole snapshot was generated (WAT).",
  },
  {
    q: "Can I turn a row into a slip?",
    a: "Yes — expand any row and use 'Analyze in Slip Lab'. The Slip Lab re-checks that leg against the live snapshot, computes joint probability, correlation risk and an analytical summary. It never calls a slip 'safe'.",
  },
];

export default function BoardPage() {
  const rows = oracleBoardRows();
  const events = buildBoard();
  const sum = summary();
  const valueCount = rows.filter((r) => r.signal === "VALUE" || r.signal === "STRONG VALUE").length;
  const passCount = rows.filter((r) => r.signal === "PASS" || r.signal === "NO EDGE" || r.signal === "AVOID" || (r.modelProb >= 80 && (r.edge ?? 0) < 0)).length;

  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={ld} />
      <section className="page-head ob-page-head">
        <div className="container">
          <span className="eyebrow">Sports intelligence · {fmtDate(sum.dataDate)} WAT</span>
          <h1>The Oracle Model Board</h1>
          <p className="page-sub">
            Every scored event for today, one row each. Model probability against market probability,
            the edge in between, the EV, the Oracle Score and the evidence — all of it inspectable.
            <span className={`fresh-chip fresh-${freshness().level}`}>{freshness().label}</span>
          </p>
          <div className="ob-page-stats">
            <div><b>{rows.length}</b><span>scored events</span></div>
            <div><b>{valueCount}</b><span>value calls</span></div>
            <div><b>{passCount}</b><span>declined by engine</span></div>
            <div><b>{rows.filter((r) => r.modelProb >= 80).length}</b><span>80%+ confidence</span></div>
          </div>
        </div>
      </section>

      <section className="sec-tight">
        <div className="container">
          <TerminalBoard events={events} />
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Good to know</span>
              <h2 className="section-title">Reading the board</h2>
            </div>
          </div>
          <FaqList items={FAQ} />
        </div>
      </section>

      <section className="sec-tight">
        <div className="container">
          <div className="cta">
            <h2>Found a row you like?</h2>
            <p className="section-sub" style={{ margin: "0 auto 20px", maxWidth: 560 }}>
              Send it to the Slip Lab and the engine will check every leg — probability, edge, correlation, joint odds.
            </p>
            <Link href="/slip/" className="btn btn-primary">Open Slip Lab →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
