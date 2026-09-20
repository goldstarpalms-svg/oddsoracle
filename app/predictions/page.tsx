import Link from "next/link";
import type { Metadata } from "next";
import { SPORTS, type Sport } from "@/lib/predictions";
import { bbPicks, fbPicks, fmtDate, summary, tnPicks } from "@/lib/rich";
import PredictionCard from "@/components/PredictionCardV2";
import { cardFromFootball, cardFromBasketball, cardFromTennis } from "@/lib/card";
import BestPicks from "@/components/BestPicks";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Today's Free Predictions — Football, Basketball & Tennis",
  description:
    "Today's free betting predictions across football, basketball and tennis. 1X2, over/under, BTTS, spread and match-winner picks with the real probabilities shown.",
  alternates: { canonical: "/predictions/" },
  openGraph: {
    title: "Today's Free Predictions — Football, Basketball & Tennis",
    description:
      "Free daily betting picks with the full numbers shown — Forebet probabilities, predicted scores and model cross-checks.",
  },
};

export default function PredictionsPage() {
  const sum = summary();
  // Finished matches belong in Results, not in today's predictions — showing
  // settled games as upcoming picks is the single biggest source of complaints.
  const fb = fbPicks().filter((p) => !p.result);
  const bb = bbPicks().filter((p) => !p.result);
  const tn = tnPicks().filter((p) => !p.result);

  const sections: {
    sport: Sport;
    title: string;
    items: any[];
    render: (p: any) => JSX.Element;
  }[] = [
    { sport: "football", title: "Football", items: fb, render: (p) => <PredictionCard key={p.id} card={cardFromFootball(p)} /> },
    { sport: "basketball", title: "Basketball", items: bb, render: (p) => <PredictionCard key={p.id} card={cardFromBasketball(p)} /> },
    { sport: "tennis", title: "Tennis", items: tn, render: (p) => <PredictionCard key={p.id} card={cardFromTennis(p)} /> },
  ];

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Today's Free Betting Predictions",
    numberOfItems: sum.total,
    itemListElement: sections
      .flatMap((s) => s.items)
      .slice(0, 80)
      .map((p: any, i: number) => ({
        "@type": "ListItem",
        position: i + 1,
        name: "p1" in p ? `${p.p1} vs ${p.p2}` : `${p.home} vs ${p.away}`,
      })),
  };

  return (
    <>
      <JsonLd data={ld} />

      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Predictions</span>
          </div>
          <span className="eyebrow">{fmtDate(sum.dataDate)} · updated every morning · 18+</span>
          <h1>
            Today&rsquo;s <span className="grad-text">Free Predictions</span>
          </h1>
          <p className="section-sub">
            {sum.total} picks across football, basketball and tennis — each with the real
            probabilities, a predicted score and the reasoning in plain words. Free forever.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <BestPicks limit={6} />
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="chips" style={{ marginBottom: 10 }}>
            {sections.map((s) => (
              <Link key={s.sport} href={`/predictions/${s.sport}/`} className="chip active">
                {s.title} · {s.items.length}
              </Link>
            ))}
          </div>

          {sections.map(({ sport, title, items, render }) => {
            if (!items.length) return null;
            const meta = SPORTS[sport];
            return (
              <div key={sport} style={{ marginBottom: 52 }}>
                <div className="section-head">
                  <div>
                    <span className="eyebrow">{title}</span>
                    <h2 className="section-title" style={{ fontSize: 28 }}>
                      {meta.singular} predictions
                    </h2>
                    <p className="section-sub">{meta.blurb}</p>
                  </div>
                  <Link href={`/predictions/${sport}/`} className="btn btn-ghost">
                    Filters &amp; combo →
                  </Link>
                </div>
                <div className="pred-grid" style={{ alignItems: "start" }}>
                  {items.slice(0, sport === "football" ? 12 : items.length).map(render)}
                </div>
                {sport === "football" && items.length > 12 && (
                  <div style={{ marginTop: 18, textAlign: "center" }}>
                    <Link href="/predictions/football/" className="btn btn-primary">
                      See all {items.length} football games →
                    </Link>
                  </div>
                )}
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
            Every pick shows the chance of each outcome, the odds and a predicted score. Before
            you place anything, double-check team news and line-ups — an injury or a rotated
            squad can change the picture. Treat our calls as informed opinions that help you
            think, not as certainties.
          </p>
          <div className="callout">
            No one can guarantee a win. Our aim is long-term value: finding picks where the price
            looks fair or generous relative to the true chance. Please gamble responsibly and
            only with money you can afford to lose.
          </div>
        </div>
      </section>
    </>
  );
}
