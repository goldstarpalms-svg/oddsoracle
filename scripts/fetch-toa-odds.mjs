/**
 * fetch-toa-odds.mjs — daily odds snapshot from TheOddsAPI (server-side key).
 *
 * Pulls live pre-match odds for the sports the free key covers
 * (baseball_mlb in season, basketball_nba from October) and writes a
 * compact, curated snapshot to backend/app/daily/odds.json that
 * bundle-data.mjs folds into the site snapshot for the "Odds compare" tool.
 *
 * Key source order: THEODDSAPI_KEY env var → .env.local.
 * Run: node scripts/fetch-toa-odds.mjs   (wired into the daily refresh)
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
  console.log("No THEODDSAPI_KEY found — skipping odds fetch (site keeps last snapshot).");
  process.exit(0);
}

const BASE = "https://api.theoddsapi.com";
const SPORTS = [
  { key: "baseball_mlb", label: "MLB (baseball)" },
  { key: "basketball_nba", label: "NBA (basketball)" },
];

const BOOK_MAP = {
  bet365: "Bet365",
  pinnacle: "Pinnacle",
  draftkings: "DraftKings",
  fanatics: "Fanatics",
  caesars: "Caesars",
  betmgm: "BetMGM",
  williamhill: "William Hill",
  betway: "Betway",
  pointsbet: "PointsBet",
  mybookie: "MyBookie",
  sportsbetio: "Sportsbet.io",
  betonline: "BetOnline",
  bovada: "Bovada",
  hardrock: "Hard Rock Bet",
  "188bet": "188bet",
  betfred: "BetFred",
  betvictor: "BetVictor",
  bwin: "Bwin",
  unibet: "Unibet",
  leovegas: "LeoVegas",
  betfair: "Betfair",
  marathonbet: "Marathon Bet",
  betquest: "BetQuest",
  nairabet: "Nairabet",
  bet9ja: "Bet9ja",
  sportybet: "Sportybet",
};

const PREFFED = new Set([
  "bet365", "pinnacle", "betfair", "bwin", "betvictor", "betfred",
  "unibet", "marathonbet", "draftkings", "fanatics", "caesars",
  "betmgm", "williamhill", "betway", "pointsbet", "nairabet", "bet9ja", "sportybet",
]);

const prettyBook = (raw) => {
  const lower = String(raw || "").toLowerCase();
  for (const [k, v] of Object.entries(BOOK_MAP)) if (lower.includes(k)) return v;
  return String(raw || "").replace(/[_-]/g, " ").replace(/us|uk|eu/gi, "").trim() || raw;
};

const americanToDec = (a) => {
  if (a == null || !isFinite(a) || a === 0) return null;
  const d = a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
  return Math.round(d * 100) / 100;
};

async function fetchSport(sportKey) {
  const url = `${BASE}/odds/?sport_key=${encodeURIComponent(sportKey)}`;
  const res = await fetch(url, { headers: { "x-api-key": KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sportKey}`);
  const j = await res.json();
  const events = (j && j.data) || [];
  if (!Array.isArray(events) || events.length === 0) return [];

  const now = Date.now();
  const horizon = now + 72 * 3600 * 1000;

  const out = [];
  for (const e of events) {
    const start = e.start_time ? new Date(e.start_time).getTime() : NaN;
    if (isFinite(start) && (start < now - 2 * 3600 * 1000 || start > horizon)) continue;
    if (!e.home_team || !e.away_team) continue;

    const h2h = {};
    const totals = {};
    const spreads = {};
    for (const b of e.books || []) {
      if (b.market === "h2h") {
        const o = b.outcomes || [];
        const home = o.find((x) => x.name === e.home_team);
        const away = o.find((x) => x.name === e.away_team);
        if (home && away) {
          h2h[b.book] = { home: americanToDec(home.price), away: americanToDec(away.price) };
        }
      } else if (b.market === "totals") {
        const o = b.outcomes || [];
        const over = o.find((x) => /over/i.test(x.name || ""));
        const under = o.find((x) => /under/i.test(x.name || ""));
        if (over && under) {
          totals[b.book] = {
            line: over.point ?? under.point ?? null,
            over: americanToDec(over.price),
            under: americanToDec(under.price),
          };
        }
      } else if (b.market === "spreads") {
        const o = b.outcomes || [];
        const home = o.find((x) => x.name === e.home_team);
        const away = o.find((x) => x.name === e.away_team);
        if (home || away) {
          spreads[b.book] = {
            point: home?.point ?? away?.point ?? null,
            home: americanToDec(home?.price),
            away: americanToDec(away?.price),
          };
        }
      }
    }
    // keep the well-known books first, then fill up to 10
    const keep = (obj, n = 10) => {
      const keys = Object.keys(obj).sort((a, b) => {
        const pa = PREFFED.has(String(a).toLowerCase().split("_")[0]) ? 0 : 1;
        const pb = PREFFED.has(String(b).toLowerCase().split("_")[0]) ? 0 : 1;
        return pa - pb;
      });
      const trimmed = {};
      for (const k of keys.slice(0, n)) trimmed[k] = obj[k];
      return trimmed;
    };
    const h = keep(h2h);
    const t = keep(totals);
    const sp = keep(spreads);
    if (Object.keys(h).length === 0 && Object.keys(t).length === 0 && Object.keys(sp).length === 0) continue;
    out.push({
      home: e.home_team,
      away: e.away_team,
      start: e.start_time || null,
      h2h: h,
      totals: t,
      spreads: sp,
    });
  }
  out.sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  return out.slice(0, 40);
}

const result = { generatedAt: new Date().toISOString(), sports: {} };
for (const s of SPORTS) {
  try {
    const events = await fetchSport(s.key);
    result.sports[s.key] = { label: s.label, events };
    console.log(`${s.label}: ${events.length} events with odds`);
  } catch (err) {
    result.sports[s.key] = { label: s.label, events: [], error: String(err.message || err) };
    console.log(`${s.label}: FAILED — ${err.message || err}`);
  }
}

const OUT = path.join(process.cwd(), "backend", "app", "daily", "odds.json");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`odds.json written (${kb} KB)`);
