# OddsOracle — Free Multi-Sport Betting Predictions

A fast, SEO-first static website for free football, basketball and tennis betting
predictions. Built with **Next.js App Router** in **static export** mode so every
page is server-rendered, crawlable HTML that Google can index immediately.

---

## Live & tech

- **App:** Next.js 14 (App Router), TypeScript, static export (`output: "export"`)
- **Hosting:** Vercel (free, auto-deploys on push to `main`)
- **Data:** hard-coded in `lib/predictions.ts` (no database, no server needed)
- **Fonts:** system/Inter fallback — no external requests, fast LCP

---

## Running locally

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # generates static site in ./out
npm run start     # serve the production build
```

---

## How to update the predictions (most common task)

Open **`lib/predictions.ts`**. Each prediction is an object:

```ts
{
  id: "fb-09",                         // unique id
  sport: "football",                   // football | basketball | tennis | other
  league: "Premier League",
  home: "Manchester City",
  away: "Arsenal",
  kickoff: "Today · 16:30",
  market: "Both Teams To Score",       // the market we're betting
  tip: "YES",                          // the actual pick
  confidence: "High",                  // High | Balanced | Value
  odds: "1.70",
  analysis: "Why we like it…",         // the SEO-worthy content
}
```

- Add/remove/edit entries, then `npm run build`. The new picks appear across the
  homepage, the `/predictions/` page, and the correct sport page automatically.
- **Tip:** write a real, unique `analysis` paragraph for each pick — this is the
  content that helps you rank. Don't just paste odds.

---

## SEO features baked in

- **Canonical URLs** on every page (trailing slash enabled).
- **Title + meta description** per page (homepage, `/predictions`, each sport
  page, and all info pages).
- **OpenGraph + Twitter cards** with a branded 1200×630 image (`public/og.png`).
- **Structured data (JSON-LD):** `Organization`, `WebSite`, `ItemList`
  (predictions), `FAQPage` (10+ Q&As), plus FAQ on the `/faq` page.
- **`sitemap.xml`** (`app/sitemap.ts`) and **`robots.txt`** (`app/robots.ts`) —
  auto-generated at build, pointing to the live domain.
- **Keywords** in `app/layout.tsx` metadata.
- **Schema for Google Rich Results** and Knowledge Panel eligibility.

### Change the live domain
Update `domain` and `url` in **`lib/site.ts`** (and the sitemap/robots pick it up
automatically).

---

## Ads

Ad slots live in `components/AdSlot.tsx` and are placed on the homepage and the
/predictions pages. Each renders a labelled placeholder.

To go live with ads (e.g. Google AdSense):
1. Paste your ad unit code inside the `AdSlot` `<aside>` (replace the placeholder
   div).
2. Or replace the `<AdSlot .../>` usage with your own script/snippet.
3. Verify your site in AdSense, then add the AdSense verification meta tag to
   `app/layout.tsx`.

---

## Monetize / grow ideas

- Add a **best bookmaker / top-betting-sites** page with affiliate links.
- Add a **prediction accuracy / results** page tracking past picks (great for
  trust + ranking).
- Publish **blog posts** (analysis, strategy, league guides) as new routes.

---

## Deploy (Vercel)

Push to GitHub → import in Vercel → done. Build command `npm run build`, output
directory `out`. No environment variables required for the static site.

License: © OddsOracle.
