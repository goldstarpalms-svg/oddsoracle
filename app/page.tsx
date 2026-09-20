import Link from "next/link";
import { SITE } from "@/lib/site";
import { bbPicks, fbPicks, fmtDate, freshness, summary, tnPicks, hockeyPicks, forebetBbPicks, handballPicks, oracleBoardRows } from "@/lib/rich";
import SNAPSHOT from "@/lib/data-snapshot.json";
import { FootballCard, BasketballCard, TennisCard } from "@/components/RichCard";
import BestPicks from "@/components/BestPicks";
import LiveBoard from "@/components/LiveBoard";
import HomeHero from "@/components/HomeHero";
import SafeCombos from "@/components/SafeCombos";
import OracleBoard from "@/components/OracleBoard";
import AdSlot from "@/components/AdSlot";
import FaqList from "@/components/FaqList";
import JsonLd from "@/components/JsonLd";
import { FAQ } from "@/lib/faq";

const SPORT_ICONS: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
  other: "⚾",
};

export default function Home() {
  const sum = summary();
  const fb = fbPicks();
  const bb = bbPicks();
  const tn = tnPicks();

  // Featured: strongest bankers across sports (football first).
  const featured: any[] = [];
  [...fb.filter((x) => x.banker), ...bb.filter((x) => x.banker), ...tn.filter((x) => x.banker)]
    .slice(0, 4)
    .forEach((p: any) => featured.push(p));
  if (featured.length === 0) {
    [...fb, ...bb, ...tn].slice(0, 4).forEach((p: any) => featured.push(p));
  }

  const sports = [
    { slug: "football", label: "Football", count: sum.football, blurb: "1X2 with Forebet % bars, predicted scores, O/U and BTTS across 90+ games daily." },
    { slug: "basketball", label: "Basketball", count: sum.basketball, blurb: "Moneyline with Forebet home/away split, predicted final scores and totals." },
    { slug: "tennis", label: "Tennis", count: sum.tennis, blurb: "Match winner + predicted set scores with the full probability split." },
    { slug: "other", label: "More Sports", count: sum.other, blurb: "MLB with live bookmaker prices + NCAA American football with Forebet picks." },
  ];

  const featuredLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Today's Free Betting Predictions",
    itemListElement: sports.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.label} predictions — ${s.count} games today`,
      url: `${SITE.url}/predictions/${s.slug}/`,
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

      <HomeHero />

      {/* ORACLE MODEL BOARD — 4.0 signature, compact */}
      <section className="sec-tight">
        <div className="container">
          <OracleBoard rows={oracleBoardRows()} compact />
        </div>
      </section>

      {/* STATS BAND */}
      <section className="sec-tight">
        <div className="container">
          <div className="stats-band">
            <div className="statbox">
              <div className="n grad-text">{sum.football}</div>
              <div className="l">⚽ Football games</div>
            </div>
            <div className="statbox">
              <div className="n grad-text">{sum.basketball}</div>
              <div className="l">🏀 Basketball games</div>
            </div>
            <div className="statbox">
              <div className="n grad-text">{sum.tennis}</div>
              <div className="l">🎾 Tennis matches</div>
            </div>
            <div className="statbox">
              <div className="n grad-text">0₦</div>
              <div className="l">Cost — everything free</div>
            </div>
          </div>
        </div>
      </section>

      {/* ALWAYS-ON BEST PICKS */}
      <section className="sec-tight">
        <div className="container">
          <BestPicks limit={6} />
        </div>
      </section>

      {/* DAILY SAFE COMBO */}
      {sum.combo && sum.combo.legs.length > 0 && (
        <section className="sec">
          <div className="container">
            <div className="combo-box combo-box-home">
              <div className="combo-head">
                <span className="combo-title">🔥 Today&rsquo;s Daily Combo ({sum.combo.legs.length}-leg)</span>
                <span className="combo-total">
                  @{sum.combo.totalOdds.toFixed(2)} · <small>{sum.combo.allHitProb}% to land all</small>
                </span>
              </div>
              <div className="combo-legs">
                {sum.combo.legs.map((l, i) => (
                  <div className="combo-leg" key={l.id}>
                    <span className="combo-leg-n">{i + 1}</span>
                    <span className="combo-leg-match">
                      {l.home} <em>vs</em> {l.away}
                    </span>
                    <span className="combo-leg-pick">{l.pick}</span>
                    <span className="combo-leg-odds">@{l.odds.toFixed(2)}</span>
                    <span className="combo-leg-prob">{l.prob}%</span>
                  </div>
                ))}
              </div>
              <div className="combo-foot">
                <p className="combo-note">
                  Only take it as a full combo, stake 1 unit max.{" "}
                </p>
                <Link href="/predictions/football/" className="btn btn-primary btn-sm">
                  See all {sum.football} football games →
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* DAILY SAFE 20 / 10 / 5 — auto-generated, every leg 80%+ */}
      <SafeCombos />

      {/* SPORTS */}
      <section className="sec">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pick your game</span>
              <h2 className="section-title">Predictions by sport</h2>
              <p className="section-sub">
                Jump straight in. Each section is rebuilt every morning with fresh data.
              </p>
            </div>
          </div>
          <div className="sport-grid">
            {sports.map((s) => (
              <Link key={s.slug} href={`/predictions/${s.slug}/`} className={`sport-card sport-${s.slug}`}>
                <div className="sport-ico">{SPORT_ICONS[s.slug]}</div>
                <h3>{s.label}</h3>
                <p className="section-sub" style={{ fontSize: 14 }}>{s.blurb}</p>
                <div className="count">{s.count} games today →</div>
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
              <h2 className="section-title">The bankers of the day</h2>
              <p className="section-sub">
                The picks with the highest chance of winning. Full board has {sum.total} more.
              </p>
            </div>
            <Link href="/predictions/" className="btn btn-ghost">View all →</Link>
          </div>

          <div className="pred-grid">
            {featured.map((p: any, i) =>
              "model" in p || "fb_pct" in p ? (
                <FootballCard key={p.id || i} p={p} />
              ) : "fb_prob" in p ? (
                <BasketballCard key={p.id || i} p={p} />
              ) : (
                <TennisCard key={p.id || i} p={p} />
              )
            )}
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
              <h2 className="section-title">How to read a pick (in one breath)</h2>
            </div>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">1</div>
              <h3>Look at the bar</h3>
              <p>
                The coloured bar is the chance of each outcome. Home win, draw, away win — the
                green bit is the pick. 70% green means 7 out of 10 times this happens.
              </p>
            </div>
            <div className="step">
              <div className="n">2</div>
              <h3>Check the @ number</h3>
              <p>
                That&rsquo;s the payout. @1.85 means bet ₦100, win ₦185 back (₦85 profit). Bigger
                number = fatter payout = bigger risk. The 🏦 and 💎 badges tell you which side
                of the risk we think you&rsquo;re on.
              </p>
            </div>
            <div className="step">
              <div className="n">3</div>
              <h3>Stake it small</h3>
              <p>
                One unit per pick, never chase a loss, and treat every prediction as an opinion —
                not a promise. The ones with the model cross-check are the ones we&rsquo;d stake
                first.
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
            <h2 className="section-title">Free football, basketball &amp; tennis predictions, rebuilt every morning</h2>
            <p>
              {SITE.name} keeps the noise down and the logic up. The football board fuses
              Forebet&rsquo;s probabilities with our own model, so every pick shows both sides of
              the argument. Basketball comes with predicted final scores and totals, and tennis
              carries the full probability split plus a set-score call.
            </p>
            <p>
              Everything is free, everything is written in plain English, and the track-record
              page shows the real numbers as results come in — wins and losses both.
            </p>
            <div className="callout">
              <strong>Please bet responsibly.</strong> Predictions are opinions and can lose.
              Only stake what you can afford; if it stops being fun, reach out for help (see
              Responsible Gambling).
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
              Free, daily, and updated fresh every morning. Check the full board before kick-off.
            </p>
            <Link href="/predictions/" className="btn btn-primary">Open today&rsquo;s picks →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
