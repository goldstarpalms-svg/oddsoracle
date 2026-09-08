export const SITE = {
  name: "OddsOracle",
  shortName: "OddsOracle",
  tagline: "Free multi-sport betting predictions, every day.",
  description:
    "OddsOracle delivers free football, basketball and tennis betting predictions with clear picks and analysis. Updated daily, built for bettors who want value and clarity.",
  domain: "oddsoracle.vercel.app",
  url: "https://oddsoracle.vercel.app",
  locale: "en_US",
  language: "en",
  twitterHandle: "@oddsoracle",
  email: "tips@oddsoracle.vercel.app",
  foundedYear: "2026",
  author: "OddsOracle Team",
} as const;

export const NAV = [
  { label: "Home", href: "/" },
  { label: "Today's Picks", href: "/predictions/" },
  { label: "Football", href: "/predictions/football/" },
  { label: "Basketball", href: "/predictions/basketball/" },
  { label: "Tennis", href: "/predictions/tennis/" },
  { label: "About", href: "/about/" },
] as const;
