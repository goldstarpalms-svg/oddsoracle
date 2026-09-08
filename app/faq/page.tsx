import Link from "next/link";
import type { Metadata } from "next";
import FaqList from "@/components/FaqList";
import JsonLd from "@/components/JsonLd";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ — Free Betting Predictions",
  description:
    "Answers to common questions about OddsOracle free predictions, how picks are made, confidence labels and responsible gambling.",
  alternates: { canonical: "/faq/" },
};

export default function FaqPage() {
  const ld = {
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
      <JsonLd data={ld} />
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>FAQ</span>
          </div>
          <h1>Frequently asked questions</h1>
          <p className="section-sub">
            The answers bettors ask us most.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container" style={{ maxWidth: 820 }}>
          <FaqList items={FAQ} />
          <div className="callout" style={{ marginTop: 24 }}>
            Still have a question?{" "}
            <Link href="/contact/" style={{ textDecoration: "underline" }}>Get in touch</Link>{" "}
            — we&rsquo;re happy to help.
          </div>
        </div>
      </section>
    </>
  );
}
