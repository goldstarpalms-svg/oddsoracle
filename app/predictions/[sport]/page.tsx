import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SPORTS, type Sport } from "@/lib/predictions";
import {
  bbPicks,
  fbPicks,
  fmtDate,
  freshness,
  summary,
  tnPicks,
} from "@/lib/rich";
import SportPicks from "@/components/SportPicks";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { SITE } from "@/lib/site";

export const revalidate = 600;

const SEO: Record<Sport, { title: string; meta: string; intro: string[] }> = {
  football: {
    title: "Football Predictions — 1X2, Over/Under & BTTS",
    meta:
      "Free football predictions today: 1X2, over/under 2.5, both teams to score and accumulator picks across the Premier League, La Liga, Serie A and more.",
    intro: [
      "Every game below carries Forebet&rsquo;s own 1/X/2 percentages, a predicted score and our model&rsquo;s cross-check — so you see exactly how sure each side is, not just a naked tip.",
      "Start with the 🏦 Safe picks tab if you want the calm side of the day, or 💎 Value if you want fatter odds with the risk explained.",
    ],
  },
  basketball: {
    title: "Basketball Predictions — Moneyline, Spreads & Totals",
    meta:
      "Free basketball predictions and picks on moneyline, point spreads and totals (over/under) across the NBA, EuroLeague, VTB and international leagues.",
    intro: [
      "Basketball is a numbers game — so we show you the numbers: Forebet&rsquo;s home/away split, the predicted final score, the average total and the confidence grade on every game.",
      "Deep-crack games (full analysis) are flagged. The rest are straight from Forebet&rsquo;s board for today.",
    ],
  },
  tennis: {
    title: "Tennis Predictions — Match Winner & Set Scores",
    meta:
      "Free tennis predictions on match winner and predicted set scores across ATP, WTA, Davis Cup and Challenger draws, with Forebet probabilities on every match.",
    intro: [
      "Each match shows Forebet&rsquo;s probability split between the two players and the predicted set score — the two numbers that actually decide a tennis bet.",
      "🏦 Banker flags go on matches at 70%+ — the ones we&rsquo;d happily stake before a meal.",
    ],
  },
  other: {
    title: "Ice Hockey, Esports & MMA Predictions",
    meta:
      "Free predictions for ice hockey, esports, MMA and more. Extra value in the markets everyone else skips, updated when the value is on the board.",
    intro: [
      "There&rsquo;s value beyond the big three sports. When the market is right, we post picks here with the same plain-English breakdown.",
      "These markets move fast — treat every pick as a snapshot and verify current odds before you stake.",
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
  return {
    title: meta.title,
    description: meta.meta,
    alternates: { canonical: `/predictions/${sport}/` },
    openGraph: { title: meta.title, description: meta.meta },
  };
}

export default function SportPage({ params }: { params: { sport: Sport } }) {
  const { sport } = params;
  const meta = SEO[sport];
  const info = SPORTS[sport];
  if (!meta) notFound();

  const fb = fbPicks();
  const bb = bbPicks();
  const tn = tnPicks();
  const items =
    sport === "football" ? fb : sport === "basketball" ? bb : sport === "tennis" ? tn : [];
  const sum = summary();
  const s = sport === "football" ? fb.length : sport === "basketball" ? bb.length : tn.length;

  const names = items.map((p: any) =>
    "fb_pct" in p || "model" in p ? `${p.home} vs ${p.away}` : "p1" in p ? `${p.p1} vs ${p.p2}` : `${p.home} vs ${p.away}`
  );

  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${info.label} Predictions`,
    itemListElement: names.slice(0, 60).map((n, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: n,
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
          <span className="eyebrow">
            {fmtDate(sum.dataDate)} · {s} games · <span className={`fresh-chip fresh-${freshness().level}`}>{freshness().label}</span>
          </span>
          <h1>
            {info.label} <span className="grad-text">Predictions</span>
          </h1>
          <p className="section-sub">{info.blurb}</p>

          <div className="chips" style={{ marginBottom: 0 }}>
            <Link href="/predictions/" className="chip">All sports</Link>
            {(["football", "basketball", "tennis", "other"] as Sport[]).map((x) => (
              <Link key={x} href={`/predictions/${x}/`} className={`chip ${x === sport ? "active" : ""}`}>
                {SPORTS[x].label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <div className="prose" style={{ maxWidth: 860, marginBottom: 28 }}>
            {meta.intro.map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
            ))}
          </div>

          {s > 0 ? (
            <SportPicks
              sport={sport as "football" | "basketball" | "tennis"}
              items={items as any}
              combo={sport === "football" ? sum.combo : null}
            />
          ) : (
            <div className="callout callout-blue">
              Fresh picks for this sport are being prepared. Check back shortly — or explore the
              other sports in the meantime.
            </div>
          )}
        </div>
      </section>

      <div className="container">
        <AdSlot size="In-article (300x250)" />
      </div>

      <section className="sec-tight">
        <div className="container prose" style={{ maxWidth: 860 }}>
          <div className="callout">
            <strong>Remember:</strong> free predictions are opinions, not guarantees. Check team
            news and live odds before staking, and bet only what you can afford to lose. 18+.
          </div>
        </div>
      </section>
    </>
  );
}
