export const SITE = {
  name: "OddsOracle",
  shortName: "OddsOracle",
  tagline: "The sports intelligence terminal.",
  description:
    "OddsOracle is a quantitative sports-intelligence platform: every prediction shows the model probability, the market price, the edge, the EV, the Oracle Score and the evidence behind it — inspectable, versioned and settled publicly. Free, daily, 18+.",
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
  { label: "Oracle Board", href: "/board/" },
  { label: "Picks", href: "/predictions/" },
  { label: "Upcoming", href: "/upcoming/" },
  { label: "Football", href: "/predictions/football/" },
  { label: "Basketball", href: "/predictions/basketball/" },
  { label: "Tennis", href: "/predictions/tennis/" },
  { label: "Table Tennis", href: "/table-tennis/" },
  { label: "Pulse Board", href: "/pulse/" },
  { label: "Arbs", href: "/arbs/" },
  { label: "Live", href: "/live/" },
  { label: "Slip Lab", href: "/slip-lab/" },
  { label: "Track Record", href: "/track-record/" },
  { label: "Methodology", href: "/methodology/" },
] as const;

export const NAV_SECONDARY = [
  { label: "Today's Picks", href: "/predictions/" },
  { label: "More Sports", href: "/predictions/other/" },
  { label: "Search", href: "/search/" },
] as const;
