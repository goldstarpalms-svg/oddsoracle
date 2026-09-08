import Link from "next/link";
import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How OddsOracle handles your information and data when you use our free betting prediction site.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> <span>/</span> <span>Privacy Policy</span>
          </div>
          <h1>Privacy policy</h1>
          <p className="section-sub">Last updated: {SITE.foundedYear}</p>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 820 }}>
          <h2>What we collect</h2>
          <p>
            {SITE.name} does not require an account. We do not collect personal
            information such as your name or email unless you choose to contact us
            directly. Like most websites, we may log standard technical data such
            as browser type, pages visited and approximate location via analytics.
          </p>

          <h2>Cookies &amp; analytics</h2>
          <p>
            We may use cookies and similar technologies to understand how visitors
            use the site and to serve advertising. Third-party vendors, including
            advertising partners, may use cookies to display relevant ads. You can
            control cookies through your browser settings.
          </p>

          <h2>Advertising</h2>
          <p>
            We may display advertising to keep our content free. Ad partners may
            collect information about your visit to show relevant ads, in line with
            their own privacy policies.
          </p>

          <h2>Your rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct or
            delete your data. Contact us on the{" "}
            <Link href="/contact/" style={{ textDecoration: "underline" }}>contact page</Link>{" "}
            to exercise these rights.
          </p>

          <h2>Children</h2>
          <p>
            This site is not directed at children and we do not knowingly collect
            personal information from anyone under 18.
          </p>

          <h2>Changes</h2>
          <p>
            We may update this policy. Changes will be posted on this page with an
            updated date.
          </p>
        </div>
      </section>
    </>
  );
}
