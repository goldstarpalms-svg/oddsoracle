import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  SPORTS,
  type Sport,
} from "@/lib/predictions";
import { getPredictions } from "@/lib/generate";
import PredictionCard from "@/components/PredictionCard";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";

export const revalidate = 600;

const SEO: Record<Sport, { title: string; meta: string; intro: string[] }> = {
  football: {
    title: "Football Predictions — 1X2, Over/Under & BTTS",
    meta:
      "Free football predictions today: 1X2, over/under 2.5, both teams to score and accumulator picks across the Premier League, La Liga, Serie A and more.",
    intro: [
      "Our football predictions cut through the noise. We break down each fixture using recent form, head-to-head records, home and away splits and the wider market value, then we give you a clear pick — the 1X2, the over/under, or the both-teams-to-score call.",
      "Whether you build single bets or weekend accumulators, the same rules apply: read the reasoning, check the team news, and stake responsibly. These are free predictions with honest logic, never guarantees.",
    ],
  },
  basketball: {
    title: "Basketball Predictions — Spreads & Totals",
    meta:
      "Free basketball predictions and picks on point spreads, totals (over/under) and moneyline across the NBA, EuroLeague and Basketball Africa League.",
    intro: [
      "Basketball is a numbers game, and that&rsquo;s exactly how we play it. We look at pace, three-point volume, defensive net rating and rest days to land on a spread or a total that makes sense.",
      "From the NBA to EuroLeague and the Basketball Africa League, our basketball picks are built on the data that actually moves games. Read the reasoning, and bet only what you can afford.",
    ],
  },
  tennis: {
    title: "Tennis Predictions — Match Winner & Totals",
    meta:
      "Free tennis predictions on match winner and total games across ATP, WTA and Grand Slam draws. Surface, serve hold % and form, broken down simply.",
    intro: [
      "Tennis rewards the small edges. We weigh surface, service hold percentage, recent match-sharpness and head-to-head history to come to a match-winner or total-games pick.",
      "Our tennis predictions span the ATP, WTA and Challenger tours plus the Grand Slams. Every pick is written in plain English so you can see exactly why we&rsquo;ve made it.",
    ],
  },
  other: {
    title: "Ice Hockey, Esports & MMA Predictions",
    meta:
      "Free predictions for ice hockey, esports, MMA and more. Extra value in the markets everyone else skips, updated when the value is on the board.",
    intro: [
      "There&rsquo;s value beyond the big three sports. When the market is right, we post ice hockey, esports and MMA picks with the same level-headed analysis we apply everywhere else.",
      "These markets move fast. The odds shift quickly, so treat each pick as a snapshot and always verify current pricing before you bet.",
    ],
  },
};

export function generateStaticParams() {
  return (Object.keys(SPORTS) as Sport[]).map((sport) => ({ sport }));
}

export async function generateMetadata({
  params,
}: {
  params: { sport: Sport };
}): Promise<Metadata> {
  const { sport } = params;
  const meta = SEO[sport];
  if (!meta) return {};
  const label = SPORTS[sport].label.toLowerCase();
  return {
    title: meta.title,
    description: meta.meta,
    alternates: { canonical: `/predictions/${sport}/` },
    openGraph: {
      title: meta.title,
      description: meta.meta,
    },
  };
}

export default async function SportPage({ params }: { params: { sport: Sport } }) {
  const { sport } = params;
  const meta = SEO[sport];
  const info = SPORTS[sport];
  if (!meta) notFound();

  const result = await getPredictions();
  const items = result.predictions.filter((p) => p.sport === sport);

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${info.label} Predictions`,
    itemListElement: items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${p.home} vs ${p.away} — ${p.market}: ${p.tip}`,
    })),
  };

  return (
    <>
      <JsonLd data={ld} />

      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span>{" "}
            <Link href="/predictions/">Predictions</Link> <span>/</span>{" "}
            <span>{info.label}</span>
          </div>
          <h1>{info.label} Predictions</h1>
          <p className="section-sub">{info.blurb}</p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="chips" style={{ marginBottom: 24 }}>
            <Link href="/predictions/" className="chip">All sports</Link>
            {(["football", "basketball", "tennis", "other"] as Sport[]).map((s) => (
              <Link
                key={s}
                href={`/predictions/${s}/`}
                className={`chip ${s === sport ? "active" : ""}`}
              >
                {SPORTS[s].label}
              </Link>
            ))}
          </div>

          <div className="prose" style={{ maxWidth: 820, marginBottom: 32 }}>
            {meta.intro.map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
            ))}
          </div>

          {items.length ? (
            <div className="pred-grid">
              {items.map((p) => (
                <PredictionCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="callout callout-blue" style={{ maxWidth: 820 }}>
              Fresh picks for this sport are being prepared. Check back shortly —
              or explore the other sports in the meantime.
            </div>
          )}
        </div>
      </section>

      <div className="container">
        <AdSlot size="In-article (300x250)" />
      </div>

      <section className="sec-tight">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <div className="callout">
            <strong>Remember:</strong> these are free predictions and analytical
            opinions — not guarantees. Always check team news and live odds, and
            bet responsibly, 18+.
          </div>
        </div>
      </section>
    </>
  );
}
