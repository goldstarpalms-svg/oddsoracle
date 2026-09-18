# OddsOracle — Free Multi-Sport Betting Predictions

A fast, SEO-first static website for free football, basketball and tennis betting
predictions. Built with **Next.js App Router** in **static export** mode so every
page is server-rendered, crawlable HTML that Google can index immediately.

---

## Live & tech

- **App:** Next.js 14 (App Router), TypeScript
- **Hosting:** Vercel (free). Main SEO pages prerender statically; a `/api/predictions`
  route serves fresh picks on demand.
- **Prediction engine:** `lib/engine.ts` + `lib/provider.ts` — pulls **real odds**
  from **The Odds API**, devigs the bookmaker margin, and generates a pick for each
  market (this is the "prediction"). Falls back to curated picks when no key is set.
- **Fonts:** system/Inter fallback — no external requests, fast LCP

---

## Real-data feed (default now)

The site ships with the full **Naija daily-picks backend** in `backend/`. Prediction
data priority in `lib/generate.ts`:

1. **Local real-data feed** — `backend/app/daily/*.json` (latest files win):
   - `*_full_crack.json` — football, ~95 games/day (Forebet 1/X/2 % + forebet pick +
     predicted score + Python model fusion, banker flags)
   - `*_basketball.json` — Forebet basketball picks + deep-crack fusion
   - `*_tennis.json` — Forebet tennis picks with set scores and form rates
   Mapped into the site's card shape by `lib/localData.ts`. No API key needed.
2. **Live odds** from The Odds API (when `THE_ODDS_API_KEY` is set and local data
   is absent).
3. Curated editorial picks (last resort).

The `/api/predictions` endpoint reports `source: "local"` and the dashboard shows
"Real-data feed (Forebet + model)".

### The Python backend (`backend/`)

- `backend/app/server.py` — Flask dashboard (run: `python3 backend/app/server.py`,
  opens on port 5000) with football + 🏀 basketball + 🎾 tennis sections.
- `backend/app/build_daily.py` — daily football pipeline (Forebet → model fusion →
  `app/daily/<date>.json`).
- `backend/app/results.py` — nightly result scoring into `app/results/history.json`.
- `backend/data/` — football-data.co.uk season CSVs (26/27) the model trains on.
- `backend/model.py`, `model2.py`, `backend/value.py` — the probability/edge models.

**Daily refresh:** pull Forebet's day page, regenerate `backend/app/daily/<DATE>*.json`,
then `npm run build` (or just wait — ISR revalidates every 10 min on a server).

## Sekta Cup (table-tennis) — `sekta-cup/`

The **Setka Prediction App**: a standalone Streamlit app for Setka Cup /
table-tennis analysis (merged from the `Sekta-cup` repo).

- Live prediction board with confidence filters + set-count Over/Under
- Trading Desk (live ticker, protection mode, stop-loss, bankroll caps, GREEN/WATCH/NO BET)
- Strong Pick Tracker, Bankroll Journal, Live Match Center (in-play scores)
- Model Intelligence (calibrated probabilities, fatigue risk, market confidence)
- First Set Intelligence Engine, Accuracy Lab backtesting, stake calculator
- 19MB match-history CSV in `sekta-cup/data/` + leaderboard

Run it (independent of the Next.js site):

```bash
cd sekta-cup
pip install -r requirements.txt
streamlit run app.py
```

## Make it actually predict games (live odds mode)

The site already ships a working prediction engine. By default it uses the local
real-data feed (see above). To add **live market odds** on top:

### 1. Get a free API key
Sign up at **the-odds-api.com** (free tier, ~500 requests/month — plenty for daily
picks) and copy the key.

### 2. Add it as a Vercel environment variable
In Vercel → your project → **Settings → Environment Variables**:
```
THE_ODDS_API_KEY = your_key_here
```
(Optional) `GEMINI_API_KEY` + `AI_WRITE=true` to have Gemini rewrite each pick's
analysis paragraph for richer SEO copy.

### 3. How it works
- `lib/provider.ts` fetches upcoming events + odds for the sports in
  `FEATURED_SPORT_KEYS`.
- `lib/engine.ts` `buildPredictions()` strips the bookmaker margin (devig) and picks
  the market-favored side on each h2h / totals market, labelling confidence
  (High/Balanced/Value) from the fair probability.
- `lib/generate.ts` caches the result for 5 minutes and falls back to the curated
  picks if there is no key/no data.
- `app/api/predictions/route.ts` serves this as JSON (cached, `s-maxage=300`).
- `components/LivePicks.tsx` (homepage hero) fetches it and refreshes every 5
  minutes — **no rebuild needed**.

### 4. Refresh triggers
- The `/api/predictions/` endpoint is cached 5 min. Clients see fresh picks.
- Call `POST /api/predictions/?refresh=1` (from a cron) to force a recompute.
- Add a Vercel Cron (Settings → Cron Jobs) hitting that route hourly/daily to keep
  it warm and fresh.

### Which sports/leagues
Edit `FEATURED_SPORT_KEYS` in `lib/provider.ts`. Each key = one API request. See
the Odds API list for valid keys (e.g. `soccer_epl`, `basketball_nba`,
`tennis_atp`).

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

Push to GitHub → import in Vercel → done. Build command `npm run build` (serverless
mode — no `output: export`). No environment variables required unless you enable
live predictions (see above).

License: © OddsOracle.
