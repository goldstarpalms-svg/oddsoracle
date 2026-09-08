import Link from "next/link";
import { SITE } from "@/lib/site";
import { featured, sportList, bySport } from "@/lib/predictions";
import PredictionCard from "@/components/PredictionCard";
import AdSlot from "@/components/AdSlot";
import FaqList from "@/components/FaqList";
import JsonLd from "@/components/JsonLd";
import { FAQ } from "@/lib/faq";

export default function Home() {
  const featuredPicks = featured(6);
  const spots = sportList();

  const featuredLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Today's Free Betting Predictions",
    itemListElement: featuredPicks.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${p.home} vs ${p.away} — ${p.market}: ${p.tip}`,
      url: `${SITE.url}/predictions/`,
    })),
  };

  const faqLd = {
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
      <JsonLd data={featuredLd} />
      <JsonLd data={faqLd} />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-inner">
            <div>
              <div className="hero-badge">
                <span className="dot" /> Updated daily · Free forever
              </div>
              <h1>
                Free betting predictions that put <span className="grad-text">value</span> first.
              </h1>
              <p className="lead">
                Daily football, basketball and tennis picks with honest written
                analysis. No hype, no guarantees — just clear thinking about
                form, odds and the market. {SITE.name} is built for bettors who
                want answers, not noise.
              </p>
              <div className="hero-actions">
                <Link href="/predictions/" className="btn btn-primary">
                  View Today&rsquo;s Picks →
                </Link>
                <Link href="/predictions/football/" className="btn btn-ghost">
                  Football Tips
                </Link>
              </div>

              <div className="hero-stats">
                <div className="stat">
                  <div className="num grad-text">4+</div>
                  <div className="lbl">Sports covered</div>
                </div>
                <div className="stat">
                  <div className="num grad-text">Daily</div>
                  <div className="lbl">Updated picks</div>
                </div>
                <div className="stat">
                  <div className="num grad-text">100%</div>
                  <div className="lbl">Free forever</div>
                </div>
                <div className="stat">
                  <div className="num grad-text">18+</div>
                  <div className="lbl">Play responsibly</div>
                </div>
              </div>
            </div>

            <div className="hero-card">
              <div className="hero-card-head">
                <span className="live"><span className="dot" /> LIVE NOW</span>
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  Today&rsquo;s top picks
                </span>
              </div>
              {featuredPicks.slice(0, 4).map((p) => (
                <div className="mini-row" key={p.id}>
                  <div>
                    <div className="mini-meta">{p.league}</div>
                    <div className="mini-teams">
                      {p.home} <span style={{ color: "var(--text-faint)" }}>v</span> {p.away}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mini-tip">{p.market}: {p.tip}</div>
                  </div>
                </div>
              ))}
              <Link href="/predictions/" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
                See all picks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAND */}
      <section className="sec-tight">
        <div className="container">
          <div className="stats-band">
            <div className="statbox">
              <div className="n grad-text">{featuredPicks.length + bySport("basketball").length + 4}+</div>
              <div className="l">Picks this week</div>
            </div>
            <div className="statbox">
              <div className="n grad-text">3</div>
              <div className="l">Core sports</div>
            </div>
            <div className="statbox">
              <div className="n grad-text">1X2</div>
              <div className="l">& O/U &amp; BTTS markets</div>
            </div>
            <div className="statbox">
              <div className="n grad-text">0₦</div>
              <div className="l">Cost — everything free</div>
            </div>
          </div>
        </div>
      </section>

      {/* SPORTS */}
      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pick your game</span>
              <h2 className="section-title">Predictions by sport</h2>
              <p className="section-sub">
                Jump straight into the coverage you care about. Each section is
                updated with fresh picks and short, readable analysis.
              </p>
            </div>
          </div>
          <div className="sport-grid">
            {spots.map((s) => (
              <Link key={s.slug} href={`/predictions/${s.slug}/`} className="sport-card">
                <div className="sport-ico">{iconFor(s.slug)}</div>
                <h3>{s.label}</h3>
                <p className="section-sub" style={{ fontSize: 14 }}>{s.blurb}</p>
                <div className="count">{s.count} predictions →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PICKS */}
      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Today&rsquo;s selections</span>
              <h2 className="section-title">Featured free predictions</h2>
              <p className="section-sub">
                A sample of what you&rsquo;ll find on the full predictions page.
                Every pick includes the reasoning behind it.
              </p>
            </div>
            <Link href="/predictions/" className="btn btn-ghost">View all →</Link>
          </div>

          <div className="pred-grid">
            {featuredPicks.map((p) => (
              <PredictionCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>

      <div className="container">
        <AdSlot size="Leaderboard (728x90)" />
      </div>

      {/* HOW IT WORKS */}
      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Simple by design</span>
              <h2 className="section-title">How OddsOracle works</h2>
            </div>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">1</div>
              <h3>Read the pick</h3>
              <p>
                Each prediction shows the league, the matchup, the market and our
                specific selection — like "Over 2.5 goals" or "BTTS: YES".
              </p>
            </div>
            <div className="step">
              <div className="n">2</div>
              <h3>Understand why</h3>
              <p>
                A short paragraph explains our reasoning: form, head-to-head,
                home/away splits and the value we see in the price. You decide if
                you agree.
              </p>
            </div>
            <div className="step">
              <div className="n">3</div>
              <h3>Bet responsibly</h3>
              <p>
                Treat every pick as an opinion, not a promise. Check team news,
                stake only what you can afford, and never chase losses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SEO INTRO */}
      <section className="sec">
        <div className="container">
          <div className="prose" style={{ maxWidth: 820 }}>
            <span className="eyebrow">Why people read us</span>
            <h2 className="section-title">Free football, basketball &amp; tennis predictions, updated out of habit</h2>
            <p>
              OddsOracle keeps the noise down and the logic up. Our football
              predictions combine form guides, goals data and market value so
              you&rsquo;re never picking blind. Over the past weeks we&rsquo;ve
              published everything from straight 1X2 selections and both-teams-to-score
              calls to over/under totals and building blocks for your weekend accumulators.
            </p>
            <p>
              For basketball we look at pace, three-point volume and defensive
              net ratings to get to the total and the spread. On the tennis side
              we weigh surface, service hold percentage and recent match-sharpness
              for match-winner and total-games value. All of it is free and all of
              it is written in plain English.
            </p>
            <div className="callout">
              <strong>Please bet responsibly.</strong> Predictions are opinions and
              can lose. Only gamble what you can afford; if it stops being fun,
              reach out for help (see Responsible Gambling).
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Good to know</span>
              <h2 className="section-title">Frequently asked questions</h2>
            </div>
          </div>
          <FaqList items={FAQ} />
        </div>
      </section>

      {/* CTA */}
      <section className="sec-tight">
        <div className="container">
          <div className="cta">
            <h2>Ready for today&rsquo;s predictions?</h2>
            <p className="section-sub" style={{ margin: "0 auto 20px", maxWidth: 560 }}>
              Free, daily and written to help you think clearly. Check the full
              board before kick-off.
            </p>
            <Link href="/predictions/" className="btn btn-primary">Open today&rsquo;s picks →</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function iconFor(slug: string): string {
  switch (slug) {
    case "football":
      return "⚽";
    case "basketball":
      return "🏀";
    case "tennis":
      return "🎾";
    default:
      return "🏒";
  }
}
