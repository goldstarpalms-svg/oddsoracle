/**
 * fetch-toa-markets.mjs — ALL markets, ALL bookmakers, for today's board.
 *
 * TheOddsAPI NEW spec (2026): base https://api.theoddsapi.com (NO /v4/),
 * auth header x-api-key, endpoint /odds/?sport_key=...&markets=...&oddsFormat=decimal.
 * Free tier covers: baseball_mlb, basketball_wnba, basketball_ncaab, tennis (all
 * ATP/WTA), icehockey_nhl, etc. European soccer = Pro plan (403 → skipped).
 *
 * Writes backend/app/daily/<YYYY-MM-DD>_markets.json:
 *   { generatedAt, soccer: [], basketball: [{home,away,t,lg,league,bookmakers:[...]}],
 *     tennis: [{home,away,t,lg,league,bookmakers:[...]}] }
 * where bookmakers = [{ name, h2h:[1,X,2], totals:[{line,over,under}],
 *                       spreads:[{point,home,away}], tees:[] }]
 *
 * Key source order: THEODDSAPI_KEY env var → .env.local.
 * Run: node scripts/fetch-toa-markets.mjs   (wired into the daily refresh)
 */
import fs from "node:fs";
import path from "node:path";

function loadKey() {
  if (process.env.THEODDSAPI_KEY) return process.env.THEODDSAPI_KEY;
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^THEODDSAPI_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  return null;
}

const KEY = loadKey();
if (!KEY) {
  console.log("No THEODDSAPI_KEY found — skipping markets fetch (site keeps last snapshot).");
  process.exit(0);
}

const BASE = "https://api.theoddsapi.com";
// free-tier sports with games on today's board (soccer = Pro → 403, handled)
const SPORTS = [
  { key: "basketball_wnba", group: "basketball", markets: "h2h,totals,spreads" },
  { key: "basketball_ncaab", group: "basketball", markets: "h2h,totals,spreads" },
  { key: "tennis", group: "tennis", markets: "h2h,totals" },
];

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[()]/g, " ")
    .replace(/\b(fc|cf|sc|ac|calcio|club|cd|ud|sd|real|de|fk)\b/g, " ")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function buildBoardMap() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });
  const daily = path.join(process.cwd(), "backend", "app", "daily", `${today}.json`);
  let d = null;
  try {
    d = JSON.parse(fs.readFileSync(daily, "utf8"));
  } catch {}
  const bb = new Map();
  if (d) {
    for (const g of d.basketball?.forebet_today_all || []) {
      const parts = String(g.match || "").split(/\sv\s/i);
      bb.set(`${norm(parts[0])}|${norm(parts[1])}`, g);
    }
    for (const g of d.tennis?.games || []) {
      bb.set(`${norm(g.p1)}|${norm(g.p2)}`, g);
    }
  }
  return { today, bb };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSport(sportKey, markets) {
  const url = `${BASE}/odds/?sport_key=${encodeURIComponent(sportKey)}&markets=${markets}&oddsFormat=decimal`;
  const res = await fetch(url, { headers: { "x-api-key": KEY } });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg += ` ${j.detail || j.error || ""}`.trim();
    } catch {}
    throw new Error(msg);
  }
  const j = await res.json();
  return j && Array.isArray(j.data) ? j.data : [];
}

function eventToGames(events, group, board) {
  const games = [];
  for (const e of events) {
    if (!e.home_team || !e.away_team) continue;
    const key = `${norm(e.home_team)}|${norm(e.away_team)}`;
    const fb = board.get(key);

    const books = new Map(); // book key → MktBook
    const bookFor = (bk) => {
      if (!books.has(bk))
        books.set(bk, { name: bk, h2h: null, totals: [], spreads: [], tees: [] });
      return books.get(bk);
    };
    for (const b of e.books || []) {
      const bk = b.book;
      const o = b.outcomes || [];
      if (b.market === "h2h") {
        const home = o.find((x) => x.name === e.home_team);
        const away = o.find((x) => x.name === e.away_team);
        const draw = o.find((x) => x.name && x.name !== e.home_team && x.name !== e.away_team);
        const h2h =
          draw && draw.price
            ? [home?.price ?? null, draw.price ?? null, away?.price ?? null]
            : [home?.price ?? null, null, away?.price ?? null];
        if (home || away) bookFor(bk).h2h = h2h;
      } else if (b.market === "totals") {
        const over = o.find((x) => /over/i.test(x.name || ""));
        const under = o.find((x) => /under/i.test(x.name || ""));
        if (over && under)
          bookFor(bk).totals.push({
            line: over.point ?? under.point ?? null,
            over: over.price ?? null,
            under: under.price ?? null,
          });
      } else if (b.market === "spreads") {
        const home = o.find((x) => x.name === e.home_team);
        const away = o.find((x) => x.name === e.away_team);
        if (home || away)
          bookFor(bk).spreads.push({
            point: home?.point ?? away?.point ?? null,
            home: home?.price ?? null,
            away: away?.price ?? null,
          });
      }
    }
    const bookmakers = [...books.values()].filter(
      (b) => b.h2h || b.totals.length > 0 || b.spreads.length > 0
    );
    if (bookmakers.length === 0) continue;

    const t = e.start_time
      ? new Date(e.start_time).toLocaleTimeString("en-NG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Africa/Lagos",
        })
      : "";
    const g = {
      home: e.home_team,
      away: e.away_team,
      t,
      lg: group === "basketball" ? (fb?.league || e.league || "Basketball") : fb?.tourn || e.league || "Tennis",
      league: e.league || "",
      bookmakers,
    };
    games.push(g);
  }
  return games;
}

const { today, bb } = buildBoardMap();
const result = { generatedAt: new Date().toISOString(), soccer: [], basketball: [], tennis: [] };

for (const s of SPORTS) {
  try {
    const events = await fetchSport(s.key, s.markets);
    const games = eventToGames(events, s.group, bb);
    result[s.group].push(...games);
    const matched = games.filter((g) => bb.has(`${norm(g.home)}|${norm(g.away)}`)).length;
    console.log(`[markets] ${s.key}: ${games.length} events (${matched} matched to today's board)`);
  } catch (err) {
    console.log(`[markets] ${s.key}: FAILED — ${err.message || err}`);
  }
  await sleep(500);
}

// key status (1 request, useful for the daily log)
try {
  const me = await (await fetch(`${BASE}/me/`, { headers: { "x-api-key": KEY } })).json();
  const d = me?.data || {};
  console.log(`[markets] key status: tier=${d.tier} used=${d.requests_today}/${d.daily_limit} remaining=${d.remaining}`);
} catch {}

const OUT = path.join(process.cwd(), "backend", "app", "daily", `${today}_markets.json`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`[markets] wrote ${today}_markets.json (${kb} KB)`);
