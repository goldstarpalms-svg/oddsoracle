import Link from "next/link";
import type { Metadata } from "next";
import { SPORTS, sportList, PREDICTIONS, type Sport } from "@/lib/predictions";
import PredictionCard from "@/components/PredictionCard";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Today's Free Predictions — Football, Basketball & Tennis",
  description:
    "Today's free betting predictions across football, basketball and tennis. 1X2, over/under, BTTS, spread and match-winner picks with concise written analysis.",
  alternates: { canonical: "/predictions/" },
  openGraph: {
    title: "Today's Free Predictions — Football, Basketball & Tennis",
    description:
      "Free daily betting picks with honest analysis across football, basketball and tennis.",
  },
};

function slugLabel(slug: Sport) {
  return SPORTS[slug];
}

export default function PredictionsPage() {
  const order: Sport[] = ["football", "basketball", "tennis", "other"];

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Today's Free Betting Predictions",
    numberOfItems: PREDICTIONS.length,
    itemListElement: PREDICTIONS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${p.home} vs ${p.away} — ${p.market}: ${p.tip}`,
    })),
  };

  return (
    <>
      <JsonLd data={ld} />

      {/* PAGE HERO */}
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Predictions</span>
          </div>
          <h1>Today&rsquo;s Free Predictions</h1>
          <p className="section-sub">
            {sportList().reduce((n, s) => n + s.count, 0)} free picks across
            football, basketball, tennis and more — each with the reasoning
            that went into it. Free forever, updated daily.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="chips">
            {order.map((s) => (
              <Link key={s} href={`/predictions/${s}/`} className="chip">
                {SPORTS[s].label} · {sportList().find((x) => x.sport === s)?.count}
              </Link>
            ))}
          </div>

          {order.map((sport) => {
            const items = PREDICTIONS.filter((p) => p.sport === sport);
            if (!items.length) return null;
            const meta = slugLabel(sport);
            return (
              <div key={sport} style={{ marginBottom: 48 }}>
                <div className="section-head">
                  <div>
                    <span className="eyebrow">{meta.label}</span>
                    <h2 className="section-title" style={{ fontSize: 28 }}>
                      {meta.singular} predictions
                    </h2>
                    <p className="section-sub">{meta.blurb}</p>
                  </div>
                  <Link href={`/predictions/${sport}/`} className="btn btn-ghost">
                    See all →
                  </Link>
                </div>
                <div className="pred-grid">
                  {items.map((p) => (
                    <PredictionCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="container">
        <AdSlot size="Leaderboard (728x90)" />
      </div>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>How to use these free predictions</h2>
          <p>
            Every pick on this page includes the market we&rsquo;re backing and a
            short rationale. Before you place anything, double-check team news and
            line-ups — an injury or a rotated squad can change the picture. Treat
            our calls as informed opinions that help you think, not as certainties.
          </p>
          <div className="callout">
            No one can guarantee a win. Our aim is long-term value: finding picks
            where the price looks fair or generous relative to the true chance.
            Please gamble responsibly and only with money you can afford to lose.
          </div>
        </div>
      </section>
    </>
  );
}
