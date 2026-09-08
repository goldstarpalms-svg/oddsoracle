import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for the OddsOracle website and its free betting prediction content.",
  alternates: { canonical: "/terms/" },
};

export default function TermsPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Terms of Use</span>
          </div>
          <h1>Terms of use</h1>
          <p className="section-sub">Last updated: {SITE.foundedYear}</p>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>1. Acceptance</h2>
          <p>
            By accessing {SITE.name}, you agree to these Terms of Use. If you do
            not agree, please do not use the site.
          </p>

          <h2>2. No gambling advice guarantees</h2>
          <p>
            {SITE.name} provides sports predictions and analysis for
            informational and entertainment purposes only. Picks are opinions, not
            guarantees, and outcomes are unpredictable. You are solely responsible
            for any bets you place. We accept no liability for losses arising from
            the use of our content.
          </p>

          <h2>3. Age requirement</h2>
          <p>
            You must be at least 18 years old (or the legal gambling age in your
            jurisdiction) to use this site. You are responsible for complying with
            the laws of your country.
          </p>

          <h2>4. Content ownership</h2>
          <p>
            All text, design and analysis published on {SITE.name} is our
            property. You may not republish or redistribute it without permission.
          </p>

          <h2>5. Third parties</h2>
          <p>
            The site may contain advertising or links to third parties. We are not
            responsible for third-party content or services.
          </p>

          <h2>6. Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the site
            means you accept the updated terms.
          </p>
        </div>
      </section>
    </>
  );
}
