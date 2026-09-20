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
import { stampFinals } from "./fetch-final.mjs";

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
let footballFile = null;
for (const cand of [
  pick([/full_crack\.json$/, /_forebet_football\.json$/]),
]) {
  football = read(cand);
  if (football && Array.isArray(football) && football.length) {
    footballFile = cand;
    break;
  }
}
// Price files must match the football board's date — the nightly 00:10 WAT
// job can create tomorrow's price file before tomorrow's board exists, and
// we must not strand today's board without its prices.
const fbDate = footballFile ? footballFile.slice(0, 10) : today;
const pickD = (patterns) => {
  const f = files.filter((x) => x.startsWith(fbDate) && patterns.some((re) => re.test(x)));
  return f.length ? f[f.length - 1] : pick(patterns);
};

let basketball = read(pick([/_basketball\.json$/]));
let tennis = read(pick([/_tennis\.json$/]));
let ncaafb = read(pick([/_ncaafb\.json$/]));
let nfl = read(pick([/_nfl\.json$/]));
let hockey = read(pick([/_hockey\.json$/]));
let forebetBaseball = read(pick([/^\d{4}-\d{2}-\d{2}_baseball\.json$/]));
let handball = read(pick([/_handball\.json$/]));
let h2h = read(pick([/^\d{4}-\d{2}-\d{2}_h2h\.json$/]));
let setka = null;

// 4.0: FULL Forebet board (every league) is the base when present; the
// tips-board rows fill any gaps. Enrichment below still merges model/oracle
// by team name, so only the model-covered games get model fields.
{
  const fullBoard = read(pickD([/_full_forebet\.json$/]));
  if (Array.isArray(fullBoard) && fullBoard.length && Array.isArray(football) && football.length) {
    const have = new Set(fullBoard.map((r) => `${r.home}|${r.away}`));
    for (const r of football) {
      if (!have.has(`${r.home}|${r.away}`)) fullBoard.push(r);
    }
    if (fullBoard.length > football.length) {
      console.log(`football: full board ${fullBoard.length} games (tips board was ${football.length})`);
      football = fullBoard;
    }
  }
}

let markets = read(pickD([/_markets\.json$/]));
let oddspapi = read(pickD([/_oddspapi\.json$/]));

// OddsPapi (350+ books) is preferred where it has data; TOA fills the rest.
if (oddspapi) {
  const merged = {
    generatedAt: oddspapi.generatedAt || markets?.generatedAt || null,
    source: "oddspapi+toa",
    soccer: oddspapi.soccer?.length ? oddspapi.soccer : markets?.soccer || [],
    basketball: oddspapi.basketball?.length ? oddspapi.basketball : markets?.basketball || [],
    tennis: oddspapi.tennis?.length ? oddspapi.tennis : markets?.tennis || [],
    americanfootball: oddspapi.americanfootball || [],
  };
  if (merged.soccer.length || merged.basketball.length || merged.tennis.length || merged.americanfootball.length)
    markets = merged;
}

// ---- Pulse-Bet enrichment --------------------------------------------------
// Written by pulse-bet -> core/fusion/forebet_fusion.py into backend/app/daily.
// Keeps Forebet's volume, adds Pulse's own probability, EV, tier and Kelly
// stake, plus an arbitrage scan over the same book prices.
let pulse = read(pickD([/_pulse\.json$/])) || read(pick([/_pulse\.json$/]));
let pulseArbs = read(pickD([/_arbs\.json$/])) || read(pick([/_arbs\.json$/]));
if (pulse?.picks?.length) {
  console.log(
    `pulse: ${pulse.picks.length} enriched picks (${pulse.model_version}) ` +
      `— bettable ${pulse.picks.filter((p) => p.bettable).length}`
  );
} else {
  console.log("pulse: no enrichment file found (run pulse-bet export-oracle)");
}
if (pulseArbs) {
  console.log(
    `pulse arbs: ${(pulseArbs.arbs || []).length} live arbs, ${(pulseArbs.watch || []).length} near-arb`
  );
}

let history = null;
try {
  history = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "backend", "app", "results", "history.json"), "utf8")
  );
} catch {}

// Enrich football rows with the FULL model (o15/o25/o35, BTTS, double chance,
// DNB, handicap, top-2 correct score, edge vs market) from the dated model file.
try {
  const modelFile = pickD([/^\d{4}-\d{2}-\d{2}\.json$/]);
  if (modelFile && Array.isArray(football)) {
    const modelDoc = read(modelFile);
    const games = (modelDoc && modelDoc.games) || [];
    const byKey = new Map();
    for (const g of games) byKey.set(`${g.home}|${g.away}`, g);
    const pct = (v) => (typeof v === "number" ? Math.round(v * 100) : null);
    let enriched = 0;
    for (const r of football) {
      const g = byKey.get(`${r.home}|${r.away}`);
      if (!g || !g.model) continue;
      const m = g.model;
      r.model = {
        pick: m.pick || "",
        p: [pct(m.p1), pct(m.px), pct(m.p2)],
        o15: pct(m.o15), o25: pct(m.o25), o35: pct(m.o35),
        btts: pct(m.btts), no_btts: pct(m.no_btts),
        dc1x: pct(m.dc1x), dcx2: pct(m.dcx2), dc12: pct(m.dc12),
        dnbH: pct(m.dnbH), dnbA: pct(m.dnbA),
        ahH: pct(m.ah_h_minus1), ahA: pct(m.ah_h_plus1),
        cs1: m.cs1 || "", cs2: m.cs2 || "",
        bank: m.bank || "",
      };
      r.mktEdge = Array.isArray(g.edge) ? g.edge.map((x) => Math.round(x * 1000) / 10) : null;
      r.fair = [m.fair1, m.fairX, m.fair2].map((x) => Math.round(x * 100) / 100);
      enriched += 1;
    }
    console.log(`model enrichment: ${enriched}/${football.length} football rows`);
  }
} catch (e) {
  console.log("model enrichment skipped:", e.message);
}

// ---- half-time / HT-FT / Asian-handicap model (backend/app/halves.py) ----
try {
  const halvesFile = pickD([/^\d{4}-\d{2}-\d{2}_halves\.json$/]);
  const halves = halvesFile ? read(halvesFile) : null;
  if (halves?.games && Array.isArray(football)) {
    let n = 0;
    for (const r of football) {
      const h = halves.games[`${r.home}|${r.away}`];
      if (!h) continue;
      r.ht = h.ht;
      r.ht_pick = h.ht_pick;
      r.htft = h.htft;
      r.ah15 = h.ah15;
      n += 1;
    }
    console.log(`halves enrichment: ${n}/${football.length} football rows (HT + HT/FT + AH 1.5)`);
  }
} catch (e) {
  console.log("halves enrichment skipped:", e.message);
}

// Rows already flagged FT by Forebet carry the REAL final score — mark them
// so the site can show "🏁 FINAL x-y" (GameGate) instead of stale cards.
for (const g of [
  ...(hockey?.games || []),
  ...(forebetBaseball?.games || []),
  ...(handball?.games || []),
  ...(basketball?.forebet_today_all || []),
  ...(basketball?.games || []),
  ...(tennis?.games || []),
]) {
  if (/^FT/i.test(String(g.status || "")) && g.score) g.final = g.score;
}
if (Array.isArray(football)) {
  for (const r of football)
    if (/^FT/i.test(String(r.status || "")) && r.fb_score) r.result = r.fb_score;
}

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

// ---------------------------------------------------------------------------
// SAFE COMBOS — auto-generate the daily 20 / 10 / 5-leg safe accumulators.
// Every leg is a pick the model (or Forebet) rates >= 80% likely to win.
// One leg per game (best probability), highest-probability legs first.
// Priced with a real bookmaker where one carries the line, else the fair
// price 100/prob (labelled "est."). Combined chance = product of leg probs.
// ---------------------------------------------------------------------------
const mnorm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/fc|cf|sc|ac|club|cd|ud|sd|real|de|fk/g, " ")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const mm = (a, b) => {
  const x = mnorm(a), y = mnorm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

function realOdds(group, home, away, kind) {
  for (const g of oddspapi?.[group] || []) {
    if (mm(g.home, home) && mm(g.away, away)) {
      const best = {};
      for (const b of g.bookmakers || []) {
        if (kind === "1x2" && Array.isArray(b.h2h)) {
          ["home", "draw", "away"].forEach((side, i) => {
            const v = b.h2h[i];
            if (v && (best[side] == null || v > best[side][0])) best[side] = [v, b.name];
          });
        }
        if (kind === "o15") {
          for (const t of b.totals || []) {
            if (t.line === 1.5 && t.over && (best.over == null || t.over > best.over[0]))
              best.over = [t.over, b.name];
          }
        }
      }
      return best;
    }
  }
  return {};
}

function buildSafeSlips() {
  const legs = [];
  const add = (sport, game, t, market, side, prob, odds, book) => {
    if (odds && odds > 1)
      legs.push({ sport, game, t, market, side, prob, odds: Math.round(odds * 100) / 100, book });
  };

  // ---- Football (full model) ----
  const modelFile = pickD([/^\d{4}-\d{2}-\d{2}\.json$/]);
  const modelDoc = modelFile ? read(modelFile) : null;
  const fbr = Array.isArray(football) ? football : [];
  for (const g of modelDoc?.games || []) {
    const h = g.home, a = g.away, t = g.kickoff || "";
    const m = g.model;
    if (!m) continue;
    const f = fbr.find((x) => mm(x.home, h) && mm(x.away, a));
    const fPct = f?.fb_pct;
    const mkt = realOdds("soccer", h, a, "1x2");
    const tot = realOdds("soccer", h, a, "o15");
    // 1X2 favourite
    const pm = Math.max(m.p1, m.px, m.p2);
    const fMax = fPct ? Math.max(...fPct) : 0; // forebet pct is already 0-100
    const prob = Math.max(pm * 100, fMax);
    if (prob >= 80) {
      const sideKey = { 1: "home", X: "draw", 2: "away" }[m.pick];
      const label = { 1: "1 (Home)", X: "X (Draw)", 2: "2 (Away)" }[m.pick];
      const r = mkt[sideKey];
      add("⚽", `${h} v ${a}`, t, "Match winner", label, Math.round(prob), r ? r[0] : 100 / prob, r ? r[1] : "est.");
    }
    // Double chance
    for (const [dc, lab] of [["dc12", "12 (No draw)"], ["dc1x", "1X"], ["dcx2", "X2"]]) {
      if (m[dc] >= 0.8) add("⚽", `${h} v ${a}`, t, "Double chance", lab, Math.round(m[dc] * 100), 100 / (m[dc] * 100), "est.");
    }
    // Over 1.5 goals
    if (m.o15 >= 0.8) {
      const r = tot.over;
      add("⚽", `${h} v ${a}`, t, "Over 1.5 goals", "Over", Math.round(m.o15 * 100), r ? r[0] : 100 / (m.o15 * 100), r ? r[1] : "est.");
    }
    // Draw no bet
    for (const [k, lab] of [["dnbH", `DNB ${h}`], ["dnbA", `DNB ${a}`]]) {
      if (m[k] >= 0.8) {
        const r = mkt[k === "dnbH" ? "home" : "away"];
        add("⚽", `${h} v ${a}`, t, "Draw no bet", lab, Math.round(m[k] * 100), r ? r[0] : 100 / (m[k] * 100), r ? r[1] : "est.");
      }
    }
  }

  const pushMl = (sport, g, h, a, t, probStr, pred) => {
    const [p1, p2] = String(probStr).split("/").map((x) => Number(x));
    if (!p1 || !p2) return;
    const favHome = Number(pred) === 1;
    const prob = Math.max(p1, p2);
    if (prob >= 80) {
      const mkt = realOdds("basketball", h, a, "1x2");
      const r = mkt[favHome ? "home" : "away"];
      add(sport, `${h} v ${a}`, t, "Moneyline", favHome ? h : a, prob, r ? r[0] : 100 / prob, r ? r[1] : "est.");
    }
  };
  for (const g of basketball?.forebet_today_all || []) {
    if (/^(FT|Cancl)/i.test(String(g.status || ""))) continue; // finished/cancelled - not bettable
    const [h, a] = String(g.match || "").split(/ v /i);
    if (h && a) pushMl("🏀", g, h, a, g.t || "", g.prob, g.pred);
  }
  for (const g of ncaafb?.games || []) {
    pushMl("🏈", g, g.home, g.away, g.t || "", g.prob, g.pred);
  }
  for (const g of hockey?.games || []) {
    if (/^FT/i.test(String(g.status || ""))) continue;
    pushMl("🏒", g, g.home, g.away, g.t || "", g.prob, g.pred);
  }
  for (const g of forebetBaseball?.games || []) {
    if (/^FT/i.test(String(g.status || ""))) continue;
    pushMl("⚾", g, g.home, g.away, g.t || "", g.prob, g.pred);
  }
  // Handball is 1X2 (3-way) — use the predicted side's own probability.
  for (const g of handball?.games || []) {
    if (/^FT/i.test(String(g.status || ""))) continue;
    const parts = String(g.prob || "").split("/").map((x) => Number(x));
    if (parts.length < 2) continue;
    const pred = String(g.pred);
    const prob = pred === "1" ? parts[0] : pred === "2" ? parts[parts.length - 1] : parts[1] || 0;
    if (prob >= 80) {
      const side = pred === "1" ? g.home : pred === "2" ? g.away : "X (Draw)";
      add("🤾", `${g.home} v ${g.away}`, g.t || "", "Match winner (1X2)", side, Math.round(prob), 100 / prob, "est.");
    }
  }
  for (const g of tennis?.games || []) {
    const [p1, p2] = String(g.prob || "").split("/").map((x) => Number(x));
    if (!p1 || !p2) continue;
    const prob = Math.max(p1, p2);
    if (prob >= 80) add("🎾", `${g.p1} v ${g.p2}`, g.t || "", "Match winner", String(g.pred || "1").startsWith("1") ? g.p1 : g.p2, prob, 100 / prob, "est.");
  }
  // MLB (implied probability from real moneyline)
  for (const e of odds?.sports?.baseball_mlb?.events || []) {
    if (e.start && new Date(e.start) <= new Date()) continue; // snapshot can contain games that have already been played
    let besth = null, besta = null;
    for (const [bk, v] of Object.entries(e.h2h || {})) {
      if (v.home && (besth == null || v.home < besth[0])) besth = [v.home, bk];
      if (v.away && (besta == null || v.away < besta[0])) besta = [v.away, bk];
    }
    const cands = [];
    if (besth) cands.push([100 / besth[0], e.home, besth]);
    if (besta) cands.push([100 / besta[0], e.away, besta]);
    cands.sort((x, y) => y[0] - x[0]);
    if (cands.length && cands[0][0] >= 80)
      add("⚾", `${e.home} v ${e.away}`, (e.start || "").slice(5, 16), "Moneyline", cands[0][1], Math.round(cands[0][0]), cands[0][2][0], cands[0][2][1]);
  }

  // one leg per game, keep the highest-probability leg
  const seen = {};
  for (const l of legs) if (!seen[l.game] || l.prob > seen[l.game].prob) seen[l.game] = l;
  const ranked = Object.values(seen).sort((a, b) => b.prob - a.prob);

  // attach the final score to legs whose game is already over (FT rows)
  const finalByName = new Map();
  const addFinal = (h, a, s) => {
    const x = mnorm(h), y = mnorm(a);
    if (x && y && s) finalByName.set(`${x}|${y}`, s);
  };
  for (const g of [
    ...(hockey?.games || []),
    ...(forebetBaseball?.games || []),
    ...(handball?.games || []),
    ...(basketball?.forebet_today_all || []),
    ...(basketball?.games || []),
  ])
    if (/^FT/i.test(String(g.status || "")) && g.score) addFinal(g.home, g.away, g.score);
  if (Array.isArray(football))
    for (const r of football)
      if (/^FT/i.test(String(r.status || "")) && r.fb_score) addFinal(r.home, r.away, r.fb_score);
  for (const l of ranked) {
    const [h, a] = String(l.game).split(/\sv\s/i);
    const x = mnorm(h), y = mnorm(a);
    if (x && y && finalByName.has(`${x}|${y}`)) l.result = finalByName.get(`${x}|${y}`);
  }

  // S20/S10/S5 reserve a few slots for non-football legs so the daily combo
  // always mixes sports (user request 20/9). Reserved slots fall back to
  // football when fewer than the slot count of other-sport legs exist.
  // Every leg still meets the 80% bar.
  const other = ranked.filter((l) => l.sport !== "⚽");
  const foot = ranked.filter((l) => l.sport === "⚽");
  const make = (n, slots) => {
    const o = Math.min(slots, other.length);
    const list = [...other.slice(0, o), ...foot.slice(0, n - o)].sort((a, b) => b.prob - a.prob);
    let total = 1, allp = 1;
    for (const l of list) { total *= l.odds; allp *= l.prob / 100; }
    return { legs: list, totalOdds: Math.round(total * 100) / 100, allHitProb: Math.round(allp * 1000) / 10 };
  };
  return {
    generatedAt: new Date().toISOString(),
    dataDate: today,
    minProb: 80,
    uniqueGames: ranked.length,
    totalLegs80: legs.length,
    s20: make(20, 4),
    s10: make(10, 2),
    s5: make(5, 1),
  };
}

let safe = null;
try {
  safe = buildSafeSlips();
  console.log(
    `safe combos: ${safe.totalLegs80} legs >=80% across ${safe.uniqueGames} games | ` +
    `S20 @${safe.s20.totalOdds} (${safe.s20.allHitProb}%) · S10 @${safe.s10.totalOdds} (${safe.s10.allHitProb}%) · S5 @${safe.s5.totalOdds} (${safe.s5.allHitProb}%)`
  );
} catch (e) {
  console.log("safe combos skipped:", e.message);
}

// ---- ODDSORACLE ENGINE v2 (multi-model + Monte Carlo + EV + signal) ----
let oracleMeta = null;
try {
  const oracleFile = pickD([/^\d{4}-\d{2}-\d{2}_oracle\.json$/]);
  const oracle = oracleFile ? read(oracleFile) : null;
  if (oracle?.games && Array.isArray(football)) {
    let n = 0;
    for (const r of football) {
      const o = oracle.games[`${r.home}|${r.away}`];
      if (o) {
        r.oracle = o;
        n += 1;
      }
    }
    oracleMeta = { modelVersion: oracle.model_version, nSims: oracle.n_sims, games: n };
    console.log(`oracle engine: ${n}/${football.length} football rows (v${oracle.model_version})`);
  }
} catch (e) {
  console.log("oracle engine skipped:", e.message);
}

// ---- TABLE TENNIS: Setka Cup intelligence -> snapshot.setka ---------------
let setkaMeta = null;
try {
  const skFile = pickD([/^\d{4}-\d{2}-\d{2}_setka\.json$/]);
  const sk = skFile ? read(skFile) : null;
  if (sk?.games) {
    setka = sk;
    setkaMeta = {
      fetchedAt: sk.fetched_at,
      games: sk.games.length,
      live: sk.games.filter((g) => g.status === "Live").length,
      history: sk.history,
    };
    console.log(`setka table tennis: ${setkaMeta.games} games (${setkaMeta.live} live)`);
  }
} catch (e) {
  console.log("setka skipped:", e.message);
}

// ---- LIVE odds: OddsChecker (keyless, 26 books) -> r.oc -------------------
let oddscheckerMeta = null;
try {
  const ocFile = pickD([/^\d{4}-\d{2}-\d{2}_oddschecker\.json$/]);
  const oc = ocFile ? read(ocFile) : null;
  if (oc?.games && Array.isArray(football)) {
    let n = 0;
    for (const r of football) {
      const o = oc.games[`${r.home}|${r.away}`];
      if (o?.win?.h) {
        r.oc = {
          h: o.win.h.best,
          x: o.win.x.best,
          a: o.win.a.best,
          htft: o.htft || null,
          nBooks: o.books ? Object.keys(o.books).length : 0,
          feedTs: o.feed_ts || null,
          ocUrl: o.oc_url || null,
        };
        n += 1;
      }
    }
    oddscheckerMeta = {
      fetchedAt: oc.fetched_at,
      games: n,
      source: "oddschecker",
    };
    console.log(`oddschecker live odds: ${n}/${football.length} football rows`);
  }
} catch (e) {
  console.log("oddschecker skipped:", e.message);
}

// ---- Forebet's extra markets (HT / HT-FT / corners / cards / goalscorers) ----
// Fetched by refresh_forebet.py daily into <date>_fb_extra.json (best effort).
try {
  const extraFile = pickD([/^\d{4}-\d{2}-\d{2}_fb_extra\.json$/]);
  const extra = extraFile ? read(extraFile) : null;
  if (extra?.games && Array.isArray(football)) {
    let n = 0;
    for (const r of football) {
      const x = extra.games[`${r.home}|${r.away}`];
      if (!x) {
        const key = Object.keys(extra.games).find((k) => {
          const [h, a] = k.split("|");
          return mmatch(h, r.home) && mmatch(a, r.away);
        });
        if (!key) continue;
        r.fbExtra = extra.games[key];
      } else r.fbExtra = x;
      n += 1;
    }
    console.log(`forebet extra markets: ${n}/${football.length} football rows`);
  }
} catch (e) {
  console.log("forebet extra skipped:", e.message);
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  dataDate: today,
  football: Array.isArray(football) ? football : [],
  basketball: basketball && basketball.games ? basketball : null,
  tennis: tennis && tennis.games ? tennis : null,
  ncaafb: ncaafb && ncaafb.games ? ncaafb : null,
  nfl: nfl && nfl.games ? nfl : null,
  hockey: hockey && hockey.games ? hockey : null,
  forebetBaseball: forebetBaseball && forebetBaseball.games ? forebetBaseball : null,
  handball: handball && handball.games ? handball : null,
  h2h: h2h && h2h.games ? h2h : null,
  oracle: oracleMeta || null,
  oddschecker: oddscheckerMeta || null,
  history: history && history.cumulative ? history : null,
  odds: odds || null,
  markets: markets || null,
  safe: safe || null,
  setka: setka || null,
  pulse: pulse && pulse.picks ? pulse : null,
  pulseArbs: pulseArbs || null,
};

// ---- FINAL scores: stamp every match that is already over (best effort) ----
try {
  await stampFinals(snapshot);
} catch (e) {
  console.log("finals stamping skipped:", e.message);
}

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
  `hockey: ${snapshot.hockey ? snapshot.hockey.games.length : 0}, ` +
  `forebet-baseball: ${snapshot.forebetBaseball ? snapshot.forebetBaseball.games.length : 0}, ` +
  `handball: ${snapshot.handball ? snapshot.handball.games.length : 0}, ` +
  `odds events: ${oddsCount}`
);
