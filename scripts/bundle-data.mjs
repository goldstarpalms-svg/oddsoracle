/**
 * Builds lib/data-snapshot.json from the backend daily JSON files.
 *
 * Why: Vercel's serverless build only bundles files statically imported by
 * the code. The daily data lives in backend/app/daily/*.json and changes
 * daily, so we snapshot the latest of each into a single JSON module that
 * lib/localData.ts imports. The deploy (triggered by the refresh commit)
 * carries that day's picks.
 *
 * Run: node scripts/bundle-data.mjs   (also wired into "prebuild")
 */
import fs from "node:fs";
import path from "node:path";

const DAILY = path.join(process.cwd(), "backend", "app", "daily");
const OUT = path.join(process.cwd(), "lib", "data-snapshot.json");

const files = fs.existsSync(DAILY)
  ? fs.readdirSync(DAILY).filter((f) => f.endsWith(".json")).sort()
  : [];
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });

function pick(patterns) {
  // patterns: [RegExp] — prefer today's file, else the latest overall
  const match = (f) => patterns.some((re) => re.test(f));
  const todays = files.filter((f) => f.startsWith(today) && match(f));
  if (todays.length) return todays[todays.length - 1];
  const any = files.filter(match);
  return any.length ? any[any.length - 1] : null;
}

function read(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DAILY, name), "utf8"));
  } catch {
    return null;
  }
}

let football = null;
for (const cand of [
  pick([/full_crack\.json$/, /_forebet_football\.json$/]),
]) {
  football = read(cand);
  if (football && Array.isArray(football) && football.length) break;
}

let basketball = read(pick([/_basketball\.json$/]));
let tennis = read(pick([/_tennis\.json$/]));

let markets = read(pick([/_markets\.json$/]));

let history = null;
try {
  history = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "backend", "app", "results", "history.json"), "utf8")
  );
} catch {}

let odds = null;
try {
  const raw = JSON.parse(
    fs.readFileSync(path.join(DAILY, "odds.json"), "utf8")
  );
  // keep the odds snapshot only if it fetched at least one event
  const hasEvents = raw && raw.sports &&
    Object.values(raw.sports).some((s) => Array.isArray(s.events) && s.events.length);
  if (hasEvents) odds = raw;
} catch {}

const snapshot = {
  generatedAt: new Date().toISOString(),
  dataDate: today,
  football: Array.isArray(football) ? football : [],
  basketball: basketball && basketball.games ? basketball : null,
  tennis: tennis && tennis.games ? tennis : null,
  history: history && history.cumulative ? history : null,
  odds: odds || null,
  markets: markets || null,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snapshot));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
const oddsCount = odds
  ? Object.values(odds.sports).reduce((acc, s) => acc + (s.events ? s.events.length : 0), 0)
  : 0;
console.log(
  `data-snapshot.json written (${kb} KB) — football: ${snapshot.football.length}, ` +
  `basketball: ${snapshot.basketball ? snapshot.basketball.games.length + " deep + " + (snapshot.basketball.forebet_today_all || []).length : 0}, ` +
  `tennis: ${snapshot.tennis ? snapshot.tennis.games.length : 0}, ` +
  `odds events: ${oddsCount}`
);
