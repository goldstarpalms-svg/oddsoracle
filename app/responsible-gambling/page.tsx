import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Responsible Gambling",
  description:
    "OddsOracle is committed to responsible gambling. Learn the signs of problem gambling, how to set limits, and where to get help.",
  alternates: { canonical: "/responsible-gambling/" },
};

export default function ResponsiblePage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Responsible Gambling</span>
          </div>
          <h1>Responsible gambling</h1>
          <p className="section-sub">
            Betting should be an enjoyable, optional pastime — never a stress, a
            necessity, or a way to escape problems.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <div className="callout">
            <strong>18+ only.</strong> This site and all betting content is intended
            for adults of legal gambling age. Underage gambling is illegal.
          </div>

          <h2>Know the signs</h2>
          <p>Problem gambling can creep up slowly. Watch out if you, or someone close to you:</p>
          <ul>
            <li>Bet more than you can afford to lose.</li>
            <li>Chase losses to "win it back".</li>
            <li>Bet to escape stress, sadness or boredom.</li>
            <li>Hide betting from family or friends.</li>
            <li>Borrow or sell things to fund a bet.</li>
            <li>Can&rsquo;t stop even when you want to.</li>
          </ul>

          <h2>Tips for staying in control</h2>
          <ul>
            <li><strong>Set a budget</strong> before you start, and stick to it.</li>
            <li><strong>Set a time limit</strong> and take breaks.</li>
            <li><strong>Never chase losses</strong> — a bet is never a "must win".</li>
            <li><strong>Never bet to solve money problems.</strong></li>
            <li><strong>Use bookmaker limits</strong> to cap deposits and losses.</li>
            <li><strong>Take it as entertainment</strong>, not income.</li>
          </ul>

          <h2>Help and support</h2>
          <p>
            If gambling is causing harm, please reach out to a local responsible
            gambling service or support group in your country. Organisations such
            as BeGambleAware, GamCare and local helplines offer free, confidential
            support. You can also self-exclude from betting operators.
          </p>

          <h2>Our stance</h2>
          <p>
            OddsOracle publishes predictions only — we do not take bets, and we
            will never promise a certain outcome. We encourage you to treat every
            pick as an opinion and to bet only for fun, only what you can afford.
          </p>
        </div>
      </section>
    </>
  );
}
