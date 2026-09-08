import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Read the OddsOracle disclaimer: predictions are free opinions for entertainment, not guarantees. 18+ and gamble responsibly.",
  alternates: { canonical: "/disclaimer/" },
};

export default function DisclaimerPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Disclaimer</span>
          </div>
          <h1>Disclaimer</h1>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <div className="callout">
            <strong>Important:</strong> sporting results are unpredictable. Nothing
            on this site is a guarantee of any outcome.
          </div>

          <h2>Informational only</h2>
          <p>
            All content on {SITE.name}, including predictions, tips and analysis,
            is provided for informational and entertainment purposes. It should not
            be treated as professional financial or gambling advice.
          </p>

          <h2>No guarantees</h2>
          <p>
            We do not, and cannot, guarantee that any prediction will win. Past
            performance does not indicate future results. Betting involves
            inherent risk and you could lose money.
          </p>

          <h2>Your responsibility</h2>
          <p>
            You are solely responsible for any decisions you make and any bets you
            place based on our content. Always use your own judgment, verify odds
            and team news, and only bet what you can afford to lose.
          </p>

          <h2>Age &amp; legality</h2>
          <p>
            You must be of legal gambling age in your jurisdiction. You are
            responsible for ensuring online betting is legal where you live.
          </p>

          <p>
            Please read our{" "}
            <Link href="/responsible-gambling/" style={{ textDecoration: "underline" }}>Responsible Gambling</Link>{" "}
            page for help and support.
          </p>
        </div>
      </section>
    </>
  );
}
