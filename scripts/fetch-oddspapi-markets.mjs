/**
 * fetch-oddspapi-markets.mjs — ALL bookmakers for today's board via OddsPapi v4.
 *
 * OddsPapi v4 (https://api.oddspapi.io/v4): 350+ bookmakers, 59+ sports.
 * Auth: ?apiKey=YOUR_KEY (ODDSPAPI_KEY env var → .env.local).
 *
 * Pulls every bookmaker's core-market prices (1X2 / moneyline, totals,
 * spreads) for today's board games and writes
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
const BASE = "https://api.oddspapi.io/v4";
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });
const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });

const empty = () => ({
  generatedAt: new Date().toISOString(),
  source: "oddspapi",
  soccer: [],
  basketball: [],
  tennis: [],
  americanfootball: [],
});
const OUT = path.join(process.cwd(), "backend", "app", "daily", `${today}_oddspapi.json`);

if (!KEY) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(empty()));
  console.log("[oddspapi] no ODDSPAPI_KEY — wrote empty file.");
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, params = {}, tries = 6) {
  const q = new URLSearchParams({ apiKey: KEY, ...params }).toString();
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(`${BASE}${p}?${q}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(45000),
      });
    } catch (e) {
      await sleep(2000);
      continue; // network hiccup / timeout — retry
    }
    if (res.status === 401) {
      const j = await res.json().catch(() => ({}));
      throw new Error(`AUTH ${j.error?.code || j.code || j.message || "401"}`);
    }
    if (res.status === 429) {
      const j = await res.json().catch(() => ({}));
      const wait = Math.min(Math.max(j.retryMs || 500, 800 * Math.pow(2, i)), 10000) + 300;
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${p}`);
    return res.json();
  }
  throw new Error(`rate-limited after retries on ${p}`);
}

// ---------- board matching ----------
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

// tennis: oddspapi lists "Surname, First" vs forebet "F. Surname"
const tmatch = (a, b) => {
  const parts = (s) => {
    s = String(s).toLowerCase().trim();
    if (s.includes(",")) {
      const [last, first] = s.split(",");
      return { last: last.trim(), first: first.trim() };
    }
    const ws = s.split(/\s+/);
    return { last: ws[ws.length - 1] || "", first: ws[0] && ws.length > 1 ? ws[0] : "" };
  };
  const pa = parts(a), pb = parts(b);
  const same = (x, y) => !!x && !!y && (x === y || (x.length > 3 && y.length > 3 && (x.startsWith(y) || y.startsWith(x))));
  if (!same(pa.last, pb.last)) return false;
  // if both have first-name info, it must agree on the first letter
  const fa = pa.first.replace(/[^a-z]/g, "")[0];
  const fb = pb.first.replace(/[^a-z]/g, "")[0];
  if (fa && fb) return fa === fb;
  return true;
};

function loadBoard() {
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
  const af = read(`${today}_ncaafb.json`) || {};
  return {
    soccer: (Array.isArray(soccer) ? soccer : []).map((g) => ({ home: g.home, away: g.away, lg: g.lg })),
    basketball: (bb.forebet_today_all || []).map((g) => {
      const [h, a] = String(g.match || "").split(/\sv\s/i);
      return { home: h, away: a, lg: g.league };
    }),
    tennis: (tn.games || []).map((g) => ({ home: g.p1, away: g.p2, lg: g.tourn })),
    afoot: (af.games || []).map((g) => ({ home: g.home, away: g.away, lg: g.league || "NCAA" })),
  };
}

// Nigerian books first, then sharps, then the big retail names.
const BOOK_PRIO = [
  "sportybet", "1xbet", "22bet", "198bet", "betano", "stake", "melbet",
  "pinnacle", "sbobet", "singbet", "betfair", "bet365", "williamhill", "betway",
  "unibet", "leovegas", "marathonbet", "betvictor", "betfred", "bwin",
  "draftkings", "fanatics", "betmgm", "caesars", "betrivers", "pointsbet", "hardrockbet",
  "kalshi", "polymarket", "mybookie", "bovada", "betonline", "18bet", "500",
];
const bookRank = (slug) => {
  const i = BOOK_PRIO.findIndex((k) => slug === k || slug.startsWith(k) || k.startsWith(slug));
  return i === -1 ? 999 : i;
};
const MAX_BOOKS = 24;

function classify(meta) {
  const t = String(meta?.marketType || "").toLowerCase();
  if (t === "1x2" || (meta?.marketLength === 3 && !t)) return "h2h3";
  if (t === "moneyline" || t === "h2h" || (meta?.marketLength === 2 && !t)) return "h2h2";
  if (t === "totals" || t === "total" || t === "o/u") return "totals";
  if (t === "spreads" || t === "spread" || t === "handicap" || t === "asianhandicap" || t === "asian-handicap") return "spreads";
  return "other";
}

function parseBook(bookData, md, kindFor, flip, twoWay) {
  // returns MktBook or null
  const out = { name: null, h2h: null, totals: [], spreads: [] };
  const bookSlug = bookData._slug;
  out.name = bookSlug;
  let h2h3 = null;
  let h2h2 = null;
  for (const [mid, m] of Object.entries(bookData.markets || {})) {
    const meta = md.get(Number(mid));
    const kind = kindFor(meta);
    if (kind === "other") continue;
    const names = meta?.names || {};
    const quotes = [];
    for (const [oid, o] of Object.entries(m?.outcomes || {})) {
      const pl = o?.players || {};
      const q = pl["0"] || Object.values(pl)[0];
      if (q && q.active !== false && typeof q.price === "number") {
        quotes.push({ oid, nm: String(names[Number(oid)] || "").toUpperCase(), price: q.price, mainLine: !!q.mainLine });
      }
    }
    if (!quotes.length) continue;
    if (kind === "h2h3" || kind === "h2h2") {
      const arr = [null, null, null];
      for (const q of quotes) {
        let idx;
        if (q.nm === "1" || q.nm === "HOME" || q.nm === "W1") idx = 0;
        else if (q.nm === "X" || q.nm === "DRAW" || q.nm === "T") idx = 1;
        else if (q.nm === "2" || q.nm === "AWAY" || q.nm === "W2") idx = 2;
        else idx = quotes.indexOf(q) === 0 ? 0 : 2;
        if (kind === "h2h2") {
          const twoIdx = idx === 1 ? 0 : idx === 2 ? 1 : 0;
          arr[twoIdx === 0 ? 0 : 2] = arr[twoIdx === 0 ? 0 : 2] ?? q.price;
        } else arr[idx] = q.price;
      }
      if (flip) {
        const t = arr[0];
        arr[0] = arr[2];
        arr[2] = t;
      }
      if (arr[0] == null && arr[2] == null) continue;
      if (kind === "h2h3") {
        if (!h2h3) h2h3 = arr;
      } else {
        if (!h2h2) h2h2 = arr;
      }
    } else if (kind === "totals") {
      const over = quotes.find((q) => /OVER/.test(q.nm)) || quotes[0];
      const under = quotes.find((q) => /UNDER/.test(q.nm)) || quotes[1];
      if (over && under && over !== under) {
        out.totals.push({
          line: typeof meta?.line === "number" ? meta.line : null,
          over: over.price,
          under: under.price,
          mainLine: over.mainLine || under.mainLine,
        });
      }
    } else if (kind === "spreads") {
      const qH = quotes.find((q) => /HOME|W1|^1$/.test(q.nm)) || quotes[0];
      const qA = quotes.find((q) => /AWAY|W2|^2$/.test(q.nm)) || quotes[1];
      if (qH && qA) {
        out.spreads.push({
          point: typeof meta?.line === "number" ? meta.line : null,
          home: qH.price,
          away: qA.price,
          mainLine: qH.mainLine || qA.mainLine,
        });
      }
    }
  }
  // choose the moneyline: 2-way books (incl. overtime) preferred for 2-way sports
  if (twoWay) {
    if (h2h2) out.h2h = h2h2;
    else if (h2h3) out.h2h = [h2h3[0], null, h2h3[2]];
  } else {
    if (h2h3) out.h2h = h2h3;
    else if (h2h2) out.h2h = [h2h2[0], null, h2h2[2]];
  }
  return out;
}

async function main() {
  const board = loadBoard();
  const out = empty();

  const sports = await api("/sports");
  const byName = {};
  for (const s of sports) {
    const n = String(s.sportName || "").toLowerCase();
    if (n === "soccer" && !byName.soccer) byName.soccer = s.sportId;
    if (n === "basketball" && !byName.basketball) byName.basketball = s.sportId;
    if (n === "tennis" && !byName.tennis) byName.tennis = s.sportId;
    if ((n === "afoot" || n === "american football" || n === "americanfootball") && !byName.afoot)
      byName.afoot = s.sportId;
  }
  console.log("[oddspapi] sport ids:", JSON.stringify(byName));

  // global market catalog (sportId param is ignored by the API — one fetch for all)
  const allMarkets = await api("/markets");
  const md = new Map();
  for (const m of allMarkets) {
    md.set(m.marketId, {
      marketType: m.marketType,
      marketLength: m.marketLength,
      period: m.period || null,
      playerProp: !!m.playerProp,
      line: typeof m.handicap === "number" ? m.handicap : null,
      names: Object.fromEntries((m.outcomes || []).map((o) => [o.outcomeId, o.outcomeName])),
    });
  }
  console.log(`[oddspapi] market catalog: ${md.size} markets`);

  // bookmaker catalog → clone roots for dedupe (1xbit → 22bet, betano.bg → betano)
  const bookList = await api("/bookmakers");
  const cloneOf = new Map(bookList.map((b) => [b.slug, b.cloneOf || null]));
  const bookRoot = (slug) => {
    let cur = slug, guard = 0;
    while (cloneOf.get(cur) && guard++ < 5) cur = cloneOf.get(cur);
    return String(cur).split(/[.-]/)[0];
  };

  const PERIOD_OK = new Set(["fulltime", "result", "regular", "match"]);
  const kindFor = (meta) => {
    if (!meta) return "other";
    if (meta.playerProp) return "other";
    if (meta.period && !PERIOD_OK.has(meta.period)) return "other";
    return classify(meta);
  };

  const TARGET_LINE = { soccer: 2.5, basketball: 220.5, tennis: 0, afoot: 51.5 };
  const GROUP = { soccer: "soccer", basketball: "basketball", tennis: "tennis", afoot: "americanfootball" };

  for (const [sport, sportId] of Object.entries(byName)) {
    if (!sportId) {
      console.log(`[oddspapi] ${sport}: not in /sports — skipped`);
      continue;
    }
    try {
      const fixtures = await api("/fixtures", { sportId, from: today, to: tomorrow });
      await sleep(300);

      // match board games (both orientations), pre-game only
      const boardGames = board[sport] || [];
      const matchFn = sport === "tennis" ? tmatch : mmatch;
      const matched = new Map(); // fixtureId → {game, flip}
      for (const f of fixtures) {
        if (f.statusId !== 0) continue;
        const p1 = f.participant1Name || "";
        const p2 = f.participant2Name || "";
        for (const g of boardGames) {
          if (matchFn(p1, g.home) && matchFn(p2, g.away)) matched.set(f.fixtureId, { game: g, flip: false });
          else if (matchFn(p1, g.away) && matchFn(p2, g.home)) matched.set(f.fixtureId, { game: g, flip: true });
        }
      }
      console.log(`[oddspapi] ${sport}: ${fixtures.length} fixtures today, ${matched.size} matched to board`);
      if (matched.size === 0) continue;

      let done = 0;
      for (const [fid, m] of matched) {
        let data;
        try {
          data = await api("/odds", { fixtureId: fid });
        } catch (e) {
          if (/^AUTH/.test(e.message)) throw e;
          console.log(`[oddspapi] ${sport} ${m.game.home} v ${m.game.away}: ${e.message} — skipped`);
          await sleep(400);
          continue;
        }
        await sleep(900);
        done++;

        const twoWay = sport !== "soccer";
        const books = new Map();
        for (const [slug, bookData] of Object.entries(data?.bookmakerOdds || {})) {
          if (bookData?.suspended) continue;
          const parsed = parseBook({ ...bookData, _slug: slug }, md, kindFor, m.flip, twoWay);
          if (parsed.h2h || parsed.totals.length || parsed.spreads.length) books.set(slug, parsed);
        }
        // trim lines: prefer mainLine, keep max 2 totals + 1 spread per book
        for (const b of books.values()) {
          b.totals = b.totals.sort((a, b2) => {
            const aa = a.mainLine ? 0 : Math.abs((a.line ?? TARGET_LINE[sport]) - TARGET_LINE[sport]);
            const ab = b2.mainLine ? 0 : Math.abs((b2.line ?? TARGET_LINE[sport]) - TARGET_LINE[sport]);
            return aa - ab;
          }).slice(0, 2);
          b.spreads = b.spreads
            .sort((a, b2) => (b2.mainLine ? 1 : 0) - (a.mainLine ? 1 : 0) || Math.abs(a.point ?? 0) - Math.abs(b2.point ?? 0))
            .slice(0, 1);
        }
        // dedupe clones / regional variants (betano.bg = betano), priority books first
        const seen = new Set();
        const kept = [];
        const slugs = [...books.keys()].sort((a, b) => bookRank(a) - bookRank(b) || a.localeCompare(b));
        for (const s of slugs) {
          if (kept.length >= MAX_BOOKS) break;
          const root = bookRoot(s);
          if (seen.has(root)) continue;
          seen.add(root);
          kept.push(books.get(s));
        }
        if (!kept.length) continue;

        const t = fTime(data?.startTime);
        out[GROUP[sport]].push({
          home: m.game.home,
          away: m.game.away,
          t,
          lg: m.game.lg || data?.tournamentName || "",
          league: data?.tournamentName || "",
          bookmakers: kept,
        });
        if (done % 20 === 0) console.log(`[oddspapi] ${sport}: ${done}/${matched.size} odds fetched`);
      }
    } catch (e) {
      if (/^AUTH/.test(e.message)) throw e;
      console.log(`[oddspapi] ${sport}: FAILED — ${e.message}`);
    }
  }

  // merge with the existing file so re-runs only ADD games, never lose them
  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(OUT, "utf8"));
  } catch {}
  if (prev) {
    for (const grp of ["soccer", "basketball", "tennis", "americanfootball"]) {
      const have = new Set((prev[grp] || []).map((g) => `${g.home}|${g.away}`));
      for (const g of out[grp]) if (!have.has(`${g.home}|${g.away}`)) (prev[grp] = prev[grp] || []).push(g);
    }
  }
  const final = prev || out;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(final));
  console.log(
    `[oddspapi] wrote ${final.soccer.length} soccer + ${final.basketball.length} basketball + ${final.tennis.length} tennis ` +
    `+ ${(final.americanfootball || []).length} american-football games ` +
    `(${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`
  );
}

function fTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" });
}

main().catch((e) => {
  if (/^AUTH/.test(e.message)) {
    console.log(`[oddspapi] key rejected (${e.message}) — re-send a valid key. Wrote empty file.`);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(empty()));
  } else {
    console.log("[oddspapi] FAILED —", e.message);
  }
  process.exit(0);
});
