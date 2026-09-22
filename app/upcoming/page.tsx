import type { Metadata } from "next";
import Link from "next/link";
import UpcomingBoard from "@/components/UpcomingBoard";
import { loadFixtures } from "@/lib/localData";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Upcoming Fixtures — Real Match List With Model Numbers",
  description:
    "Real upcoming football fixtures with model-estimated 1X2 probabilities, de-vigged market prices where books have published them, and honest NO PRICE labels where they haven't.",
  alternates: { canonical: "/upcoming/" },
};

export default function UpcomingPage() {
  const doc = loadFixtures();
  return (
    <>
      <section className="hero-4">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Upcoming</span>
          </div>
          <p className="ds-eyebrow" style={{ marginBottom: 10 }}>Fixtures</p>
          <h1 className="ds-h1">Upcoming fixtures</h1>
          <p className="ds-body" style={{ maxWidth: 700, marginTop: 10 }}>
            Every fixture we can currently see, in kickoff order. Each carries our model&rsquo;s
            estimated 1X2 split, the de-vigged market split where a bookmaker has priced it, and
            the best available price. Where no price exists yet, we say so.
          </p>
          {doc && (
            <p className="ds-meta" style={{ marginTop: 12 }}>
              Fetched {doc.date} · {doc.count} events · {doc.upcoming} upcoming
            </p>
          )}
        </div>
      </section>
      <section className="sec">
        <div className="container">
          <UpcomingBoard limit={60} />
        </div>
      </section>
    </>
  );
}
