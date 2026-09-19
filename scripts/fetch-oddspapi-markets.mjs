/**
 * fetch-oddspapi-markets.mjs — ALL bookmakers for today's board via OddsPapi.
 *
 * OddsPapi (https://v5.oddspapi.io/en): 350+ bookmakers, 59+ sports, free tier.
 * Auth: ?apiKey=YOUR_KEY (ODDSPAPI_KEY env var → .env.local).
 *
 * For today's board games (football / basketball / tennis) it pulls every
 * bookmaker's prices for the core markets — match winner (1X2 / moneyline),
 * totals (over/under) and spreads/handicaps — and writes
 * backend/app/daily/<YYYY-MM-DD>_oddspapi.json in the same shape as the
 * TOA markets file, so bundle-data.mjs folds it into the site snapshot.
 *
 * Run: node scripts/fetch-oddspapi-markets.mjs
 */
import fs from "node:fs";
import path from "node:path";

function loadKey() {
  if (process.env.ODDSPAPI_KEY) return process.env.ODDSPAPI_KEY;
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^ODDSPAPI_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
  return null;
}

const KEY = loadKey();
const BASE = "https://v5.oddspapi.io/en";

const empty = () => ({ generatedAt: new Date().toISOString(), source: "oddspapi", soccer: [], basketball: [], tennis: [] });
const OUT = () =>
  path.join(process.cwd(), "backend", "app", "daily", `${new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" })}_oddspapi.json`);

if (!KEY) {
  fs.mkdirSync(path.dirname(OUT()), { recursive: true });
  fs.writeFileSync(OUT(), JSON.stringify(empty()));
  console.log("[oddspapi] no ODDSPAPI_KEY — wrote empty file (site keeps existing feed).");
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, params = {}) {
  const q = new URLSearchParams({ apiKey: KEY, ...params }).toString();
  const res = await fetch(`${BASE}${p}?${q}`, { headers: { accept: "application/json" } });
  if (res.status === 401) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`AUTH ${j.code || j.message || "401"}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${p}`);
  return res.json();
}

// ---------- board matching (same normalizer as the TOA script) ----------
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[()]/g, " ")
    .replace(/\b(fc|cf|sc|ac|calcio|club|cd|ud|sd|real|de|fk)\b/g, " ")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const mmatch = (a, b) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

function loadBoard() {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });
  const read = (f) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(process.cwd(), "backend", "app", "daily", f), "utf8"));
    } catch {
      return null;
    }
  };
  const soccer = read(`${today}_full_crack.json`) || [];
  const bb = read(`${today}_basketball.json`) || {};
  const tn = read(`${today}_tennis.json`) || {};
  return {
    soccer: (Array.isArray(soccer) ? soccer : []).map((g) => ({ home: g.home, away: g.away, lg: g.lg })),
    basketball: (bb.forebet_today_all || []).map((g) => {
      const [h, a] = String(g.match || "").split(/\sv\s/i);
      return { home: h, away: a, lg: g.league };
    }),
    tennis: (tn.games || []).map((g) => ({ home: g.p1, away: g.p2, lg: g.tourn })),
  };
}

// Nigerian books first, then sharps, then the big retail names.
const BOOK_PRIO = [
  "nairabet", "bet9ja", "sportybet", "1xbet", "22bet", "198bet", "betano", "stake", "melbet",
  "pinnacle", "sbo", "sbobet", "singbet", "betfair", "bet365", "williamhill", "betway",
  "unibet", "leovegas", "marathonbet", "betvictor", "betfred", "bwin", "betfair_ex", "betfair_sb",
  "draftkings", "fanatics", "betmgm", "caesars", "betrivers", "pointsbet", "hardrockbet",
  "kalshi", "polymarket", "mybookie", "bovada", "betonline", "sportsbetio",
];
const bookRank = (slug) => {
  const i = BOOK_PRIO.findIndex((k) => slug === k || slug.startsWith(k) || k.startsWith(slug));
  return i === -1 ? 999 : i;
};
const MAX_BOOKS = 30;

function pickBooks(books) {
  const slugs = [...books.keys()].sort((a, b) => bookRank(a) - bookRank(b) || a.localeCompare(b));
  return slugs.slice(0, MAX_BOOKS).map((s) => books.get(s));
}

function classify(md, outcomeNames) {
  const t = String(md?.marketType || "").toLowerCase();
  if (t === "1x2" || (md?.marketLength === 3 && !t)) return "h2h3";
  if (t === "moneyline" || t === "h2h" || (md?.marketLength === 2 && !t)) return "h2h2";
  if (t === "totals" || t === "total") return "totals";
  if (t === "spreads" || t === "spread" || t === "handicap" || t === "asianhandicap") return "spreads";
  return "other";
}

function mainLineClosest(totals, target) {
  // keep up to 2 lines per book, closest to the sport's main line
  if (totals.length <= 2) return totals;
  return [...totals].sort((a, b) => Math.abs(a.line - target) - Math.abs(b.line - target)).slice(0, 2);
}

async function main() {
  const board = loadBoard();
  const out = empty();

  const sports = await api("/sports");
  const byName = {};
  for (const s of sports) {
    const n = String(s.sportName || "").toLowerCase();
    if (n.includes("soccer") && !byName.soccer) byName.soccer = s.sportId;
    if (n.includes("basketball") && !byName.basketball) byName.basketball = s.sportId;
    if (n.includes("tennis") && !byName.tennis) byName.tennis = s.sportId;
  }
  console.log("[oddspapi] sport ids:", JSON.stringify(byName));

  const TARGET_LINE = { soccer: 2.5, basketball: 220.5, tennis: 0 };
  const GROUP = { soccer: "soccer", basketball: "basketball", tennis: "tennis" };

  for (const [sport, sportId] of Object.entries(byName)) {
    if (!sportId) {
      console.log(`[oddspapi] ${sport}: not found in /sports — skipped`);
      continue;
    }
    try {
      const [markets, fixtures] = await Promise.all([api("/markets", { sportId }), api("/fixtures/today", { sportId })]);
      await sleep(200);
      const md = new Map();
      for (const m of markets) {
        md.set(m.marketId, {
          type: m.marketType,
          line: typeof m.handicap === "number" ? m.handicap : null,
          len: m.marketLength,
          names: Object.fromEntries((m.outcomes || []).map((o) => [o.outcomeId, o.outcomeName])),
        });
      }

      // keep only board games (both orientations), remember the flip
      const boardGames = board[sport] || [];
      const matched = new Map(); // fixtureId → {game, flip}
      for (const f of fixtures) {
        const p1 = f.participants?.participant1Name || "";
        const p2 = f.participants?.participant2Name || "";
        for (const g of boardGames) {
          if (mmatch(p1, g.home) && mmatch(p2, g.away)) matched.set(f.fixtureId, { game: g, flip: false });
          else if (mmatch(p1, g.away) && mmatch(p2, g.home)) matched.set(f.fixtureId, { game: g, flip: true });
        }
      }
      console.log(`[oddspapi] ${sport}: ${fixtures.length} fixtures today, ${matched.size} matched to board`);
      if (matched.size === 0) continue;

      // fetch odds per tournament containing matched fixtures
      const tourna = new Map();
      for (const f of fixtures) {
        if (!matched.has(f.fixtureId)) continue;
        tourna.set(f.tournament?.tournamentId, f.tournament?.tournamentName || "");
      }

      let loggedSample = false;
      for (const [tid, tname] of tourna) {
        let data;
        try {
          data = await api("/fixtures/odds/main", { tournamentId: tid });
        } catch (e) {
          console.log(`[oddspapi] ${sport}/${tname}: ${e.message} — skipped`);
          await sleep(300);
          continue;
        }
        await sleep(150);

        for (const f of data || []) {
          const m = matched.get(f.fixtureId);
          if (!m) continue;
          if (!loggedSample) {
            console.log(`[oddspapi] sample odds shape:`, JSON.stringify(f.odds || {}).slice(0, 500));
            loggedSample = true;
          }
          const books = new Map();
          const bookFor = (slug) => {
            if (!books.has(slug)) books.set(slug, { name: slug, h2h: null, totals: [], spreads: [], tees: [] });
            return books.get(slug);
          };

          for (const [slug, mkts] of Object.entries(f.odds || {})) {
            for (const [mid, outcomes] of Object.entries(mkts || {})) {
              const meta = md.get(Number(mid));
              const kind = classify(meta, outcomes);
              const quotes = Object.values(outcomes || {}).filter((q) => q && q.active !== false);
              if (kind === "h2h3" || kind === "h2h2") {
                if (quotes.length === 0) continue;
                const b = bookFor(slug);
                const arr = kind === "h2h3" ? [null, null, null] : [null, null, null];
                for (const q of quotes) {
                  const nm = String(meta?.names?.[q.outcomeId] || "").toUpperCase();
                  const idx = nm === "1" || nm === "HOME" || nm === "W1" ? 0 : nm === "X" || nm === "DRAW" || nm === "T" ? 1 : nm === "2" || nm === "AWAY" || nm === "W2" ? 2 : quotes.indexOf(q) === 0 ? 0 : 2;
                  if (kind === "h2h2") arr[idx === 1 ? 0 : 1] = arr[idx === 1 ? 0 : 1] ?? q.price;
                  else arr[idx] = q.price;
                }
                if (m.flip && kind === "h2h3") arr[0] = arr[2];
                b.h2h = arr;
              } else if (kind === "totals") {
                const over = quotes.find((q) => /over|o\b/i.test(String(meta?.names?.[q.outcomeId] || "")));
                const under = quotes.find((q) => /under|u\b/i.test(String(meta?.names?.[q.outcomeId] || "")));
                const qO = over || quotes[0], qU = under || quotes[1];
                if (qO && qU) bookFor(slug).totals.push({ line: meta?.line ?? null, over: qO.price, under: qU.price });
              } else if (kind === "spreads") {
                const qH = quotes.find((q) => /home|w1|^1$/i.test(String(meta?.names?.[q.outcomeId] || ""))) || quotes[0];
                const qA = quotes.find((q) => /away|2\b|w2/i.test(String(meta?.names?.[q.outcomeId] || ""))) || quotes[1];
                if (qH && qA) bookFor(slug).spreads.push({ point: meta?.line ?? null, home: qH.price, away: qA.price });
              }
            }
          }

          // trim: keep main totals lines only
          for (const b of books.values()) {
            if (b.totals.length > 2) b.totals = mainLineClosest(b.totals, TARGET_LINE[sport]);
            if (b.spreads.length > 2) b.spreads = b.spreads.slice(0, 2);
          }
          const kept = pickBooks(books).filter((b) => b.h2h || b.totals.length || b.spreads.length);
          if (!kept.length) continue;
          const t = f.startTime
            ? new Date(f.startTime * 1000).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" })
            : "";
          out[GROUP[sport]].push({
            home: m.game.home,
            away: m.game.away,
            t,
            lg: m.game.lg || tname,
            league: tname,
            bookmakers: kept,
          });
        }
      }
    } catch (e) {
      console.log(`[oddspapi] ${sport}: FAILED — ${e.message}`);
    }
  }

  fs.mkdirSync(path.dirname(OUT()), { recursive: true });
  fs.writeFileSync(OUT(), JSON.stringify(out));
  console.log(
    `[oddspapi] wrote ${out.soccer.length} soccer + ${out.basketball.length} basketball + ${out.tennis.length} tennis games ` +
    `(kb: ${(fs.statSync(OUT()).size / 1024).toFixed(1)})`
  );
}

main().catch((e) => {
  if (/^AUTH/.test(e.message)) {
    console.log(`[oddspapi] key rejected by OddsPapi (${e.message}) — re-send a valid key to activate the full bookmaker feed. Wrote empty file.`);
    fs.mkdirSync(path.dirname(OUT()), { recursive: true });
    fs.writeFileSync(OUT(), JSON.stringify(empty()));
  } else {
    console.log("[oddspapi] FAILED —", e.message);
  }
  process.exit(0);
});
