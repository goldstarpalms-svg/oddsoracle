import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/site";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import PwaInstall from "@/components/PwaInstall";
import SwRegister from "@/components/SwRegister";
import JsonLd from "@/components/JsonLd";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Free Multi-Sport Betting Predictions`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "free betting predictions",
    "football predictions today",
    "basketball predictions",
    "tennis predictions",
    "today match predictions",
    "1X2 tips",
    "over under tips",
    "both teams to score",
    "sports betting tips",
    "safe betting tips",
    "football tips today",
    "weekend predictions",
  ],
  applicationName: SITE.name,
  authors: [{ name: SITE.author }],
  creator: SITE.author,
  publisher: SITE.name,
  category: "Sports Betting Predictions",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: SITE.name,
    },
    formatDetection: { telephone: false },
    other: {
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
    },
    openGraph: {
      type: "website",
      siteName: SITE.name,
    title: `${SITE.name} — Free Multi-Sport Betting Predictions`,
    description: SITE.description,
    url: SITE.url,
    locale: SITE.locale,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${SITE.name} — Free Multi-Sport Betting Predictions`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Free Multi-Sport Betting Predictions`,
    description: SITE.description,
    site: SITE.twitterHandle,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#05080f",
  width: "device-width",
  initialScale: 1,
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/icon.svg`,
  foundingDate: SITE.foundedYear,
  description: SITE.description,
  sameAs: [`https://twitter.com/${SITE.twitterHandle.replace("@", "")}`],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  publisher: { "@type": "Organization", name: SITE.name },
  inLanguage: "en",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={SITE.language}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body>
        <a
          href="#main"
          className="visually-hidden"
          style={{ position: "absolute" }}
        >
          Skip to content
        </a>
        <JsonLd data={organizationSchema} />
        <JsonLd data={websiteSchema} />
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
        <BottomNav />
        <PwaInstall />
        <SwRegister />
      </body>
    </html>
  );
}
