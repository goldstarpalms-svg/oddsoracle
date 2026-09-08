import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About OddsOracle",
  description:
    "Learn who is behind OddsOracle and why we publish free, honest multi-sport betting predictions with clear written analysis.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>About</span>
          </div>
          <h1>About {SITE.name}</h1>
          <p className="section-sub">
            A small team that believes betting content should be honest, clear
            and actually useful.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>What we stand for</h2>
          <p>
            OddsOracle was started with a simple frustration: too much betting
            content is either vague, clickbaity, or flat-out dishonest. We
            wanted a place that gives you a clear pick, the reasoning behind it,
            and the reminder that nothing is guaranteed.
          </p>
          <p>
            That&rsquo;s the whole idea. We cover football, basketball, tennis and
            a rotating set of other sports, and every prediction ships with a
            short, readable paragraph explaining what we&rsquo;re seeing in the
            market. It&rsquo;s free, it&rsquo;s daily, and it never tries to sell
            you a "sure win."
          </p>

          <h2>How we analyse</h2>
          <ul>
            <li><strong>Form &amp; trends</strong> — recent results and scoring patterns.</li>
            <li><strong>Head-to-head</strong> — how these two sides have matched up.</li>
            <li><strong>Home/away splits</strong> — some teams are a different proposition away.</li>
            <li><strong>Market value</strong> — is the price fair or generous given the true chance?</li>
            <li><strong>Context</strong> — injuries, rotation, motivation, fatigue.</li>
          </ul>

          <h2>Our promise</h2>
          <p>
            We don&rsquo;t guarantee wins because no one honestly can. We aim for
            long-term value, and we&rsquo;ll always tell you when a pick is a
            strong lean versus a closer call. If gambling ever stops being fun,
            please step away and get help — see our{" "}
            <Link href="/responsible-gambling/">Responsible Gambling</Link> page.
          </p>

          <div className="callout-blue callout">
            Questions or feedback? Reach us on the{" "}
            <Link href="/contact/" style={{ textDecoration: "underline" }}>contact page</Link>.
          </div>
        </div>
      </section>
    </>
  );
}
