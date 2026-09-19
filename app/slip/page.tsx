import type { Metadata } from "next";
import Link from "next/link";
import SlipTools from "@/components/SlipTools";
import AdSlot from "@/components/AdSlot";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Slip Tools — Build & Analyze Your Slip",
  description:
    "Build a slip from today's OddsOracle predictions with live total odds and model probability, or paste your own slip to see what the model thinks of each leg.",
  alternates: { canonical: "/slip/" },
};

export default function SlipPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Slip Tools</span>
          </div>
          <span className="eyebrow">Your slip, checked by the numbers</span>
          <h1>
            Slip <span className="grad-text">Tools</span>
          </h1>
          <p className="section-sub">
            Build your slip from today&rsquo;s picks and see the honest math — total odds and
            the model&rsquo;s chance of it all hitting. Or paste a slip you already have and we&rsquo;ll
            check every leg against today&rsquo;s data.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <SlipTools />
        </div>
      </section>

      <div className="container">
        <AdSlot size="Leaderboard (728x90)" />
      </div>

      <section className="sec-tight">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>Coming to Slip Tools</h2>
          <p>
            The booking-code decoder is live — Sportybet, Bet9ja and Nairabet Nigeria codes can
            be opened and checked against today&rsquo;s model (free decodes are limited each day,
            so spend them on slips you really care about). The odds-compare tool shows live
            bookmaker prices side by side as the feed allows (more sports and more bookies land
            as the data plan grows). One-tap code conversion between bookmakers is next on the
            roadmap.
          </p>
          <div className="callout">
            <strong>Be careful with anyone who promises a “100% slip”.</strong> No slip is
            guaranteed. Our tools show you the math so you can size your stake with your eyes
            open.
          </div>
        </div>
      </section>
    </>
  );
}
