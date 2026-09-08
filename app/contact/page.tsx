import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import AdSlot from "@/components/AdSlot";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the OddsOracle team. Questions, feedback, partnership or media enquiries — we read everything.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Contact</span>
          </div>
          <h1>Contact us</h1>
          <p className="section-sub">
            Questions, feedback, partnership or media — drop us a line and
            we&rsquo;ll get back to you.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container contact-grid">
          <div>
            <h2 style={{ fontSize: 22 }}>Send a message</h2>
            <p className="section-sub">
              Fill this in and it will open in your email app addressed to us.
            </p>
            <form
              action={`mailto:${SITE.email}`}
              method="post"
              encType="text/plain"
              style={{ marginTop: 20 }}
            >
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" type="text" required placeholder="Your name" />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required placeholder="you@example.com" />
              </div>
              <div className="field">
                <label htmlFor="subject">Subject</label>
                <input id="subject" name="subject" type="text" placeholder="What it's about" />
              </div>
              <div className="field">
                <label htmlFor="message">Message</label>
                <textarea id="message" name="body" rows={5} required placeholder="Your message…" />
              </div>
              <button className="btn btn-primary" type="submit">Send message</button>
            </form>
          </div>

          <div>
            <h2 style={{ fontSize: 22 }}>Other ways to reach us</h2>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
              <li style={{ padding: "14px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Email</div>
                <a href={`mailto:${SITE.email}`} style={{ color: "var(--accent)" }}>{SITE.email}</a>
              </li>
              <li style={{ padding: "14px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Twitter / X</div>
                <span>{SITE.twitterHandle}</span>
              </li>
              <li style={{ padding: "14px 0" }}>
                <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Response time</div>
                <span>Usually within 24–48 hours.</span>
              </li>
            </ul>
            <AdSlot size="Medium rectangle (300x250)" />
          </div>
        </div>
      </section>
    </>
  );
}
