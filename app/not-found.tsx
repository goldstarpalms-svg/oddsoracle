import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-hero" style={{ paddingBottom: 60 }}>
      <div className="container" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, background: "var(--grad)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          404
        </div>
        <h1>That page has gone missing</h1>
        <p className="section-sub" style={{ margin: "0 auto 24px", maxWidth: 480 }}>
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
          Head back home for the latest predictions.
        </p>
        <Link href="/" className="btn btn-primary">Back to home →</Link>
      </div>
    </section>
  );
}
