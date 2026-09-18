export const SITE = {
  name: "OddsOracle",
  shortName: "OddsOracle",
  tagline: "Free multi-sport betting predictions, every day.",
  description:
    "OddsOracle delivers free football, basketball and tennis predictions with the real probabilities shown — Forebet percentages, predicted scores and a model cross-check. Updated daily, built for bettors who want value and clarity.",
  // Live production domain (GitHub → Vercel auto-deploy).
  domain: "oddsoracle-blond.vercel.app",
  url: "https://oddsoracle-blond.vercel.app",
  locale: "en_NG",
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
  { label: "Slip Tools", href: "/slip/" },
  { label: "Track Record", href: "/track-record/" },
  { label: "Methodology", href: "/methodology/" },
] as const;
