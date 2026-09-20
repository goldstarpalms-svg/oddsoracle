/**
 * Stamps FINAL scores onto the data snapshot for matches that are already over.
 *
 * Sources (best effort, network optional):
 *  1. ESPN public scoreboard API (soccer / NHL / MLB / WNBA / NCAAF) — the
 *     same open API our nightly scorer uses.
 *  2. backend/app/results/history.json — the scored audit trail (football).
 *  3. Any board row already flagged "FT" by Forebet — its score IS final.
 *
 * The client-side GameGate then either shows "🏁 FINAL 3-1" on the card or
 * removes the card entirely — so finished matches never sit stale on a board.
 *
 * Runs inside scripts/bundle-data.mjs (so every deploy re-stamps) and can be
 * run standalone:  node scripts/fetch-final.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/fc|cf|sc|ac|club|cd|ud|sd|real|de|fk|united|city/g, " ")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const mmatch = (a, b) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

const getJson = async (url, ms = 6000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
};

/** Pull finished-game scores from one ESPN scoreboard. */
const espnFinals = async (group, slug, dates) => {
  const map = new Map();
  for (const d of dates) {
    const j = await getJson(`${ESPN}/${group}/${slug}/scoreboard?dates=${d}`);
    for (const ev of j?.events || []) {
      const comp = ev?.competitions?.[0];
      const st = comp?.status?.type?.state;
      if (st !== "POST") continue;
      const home = comp?.competitors?.find((c) => c.homeAway === "home");
      const away = comp?.competitors?.find((c) => c.homeAway === "away");
      const hs = comp?.competitors?.[0]?.score ?? home?.score;
      const as = comp?.competitors?.[1]?.score ?? away?.score;
      if (!home?.team?.displayName || !away?.team?.displayName) continue;
      if (hs == null || as == null) continue;
      map.set(`${home.team.displayName}|${away.team.displayName}`, `${hs}-${as}`);
    }
  }
  return map;
};

const applyMap = (list, finalMap, getNames, setFinal, sport = "football") => {
  let n = 0;
  for (const g of list || []) {
    const [h, a] = getNames(g);
    if (!h || !a) continue;
    if (/^(FT|Cancl|AET|PEN)/i.test(String(g.status || "")) && g.score) {
      setFinal(g, g.score);
      n++;
      continue;
    }
    for (const key of finalMap.keys()) {
      const [fh, fa] = key.split("|");
      if (mmatch(fh, h) && mmatch(fa, a)) {
        setFinal(g, finalMap.get(key));
        n++;
        break;
      }
    }
  }
  return n;
};

const lagosDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });
};
const ymd = (s) => s.replaceAll("-", "");

/**
 * Mutate the snapshot object in place. Returns { stamped, source }.
 */
export async function stampFinals(snapshot, opts = {}) {
  const silent = !!opts.silent;
  const log = (m) => !silent && console.log(`finals: ${m}`);
  const date = snapshot.dataDate || lagosDate();
  const dates = [ymd(date), ymd(lagosDate(1))];
  let total = 0;

  // 1) history.json (local, always available) — football scored results
  try {
    const hist = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "backend", "app", "results", "history.json"), "utf8")
    );
    const histMap = new Map();
    for (const [day, dv] of Object.entries(hist.days || {})) {
      for (const r of dv.rows || []) {
        const [h, a] = String(r.match || "").split(/\sv\s/i);
        if (h && a && r.score) histMap.set(`${h}|${a}`, String(r.score));
      }
    }
    total += applyMap(snapshot.football, histMap, (g) => [g.home, g.away], (g, s) => (g.final = s));
  } catch {}

  // 2) ESPN — only when the board date is today-ish (stale boards don't need network)
  const daysAgo = (Date.now() - new Date(date + "T00:00:00+01:00").getTime()) / 86400000;
  if (daysAgo <= 1.5) {
    // 2a) football — league slugs from the dated model file
    try {
      const daily = path.join(process.cwd(), "backend", "app", "daily");
      const modelFile = fs.readdirSync(daily).find((f) => f === `${date}.json`);
      if (modelFile) {
        const games = JSON.parse(fs.readFileSync(path.join(daily, modelFile), "utf8")).games || [];
        const slugs = [...new Set(games.map((g) => g.league_code).filter(Boolean))];
        const fbMap = new Map();
        for (const slug of slugs) {
          const m = await espnFinals("soccer", slug, dates);
          m.forEach((v, k) => fbMap.set(k, v));
        }
        total += applyMap(snapshot.football, fbMap, (g) => [g.home, g.away], (g, s) => (g.final = s));
        log(`soccer: ${slugs.length} leagues → ${fbMap.size} finals`);
      }
    } catch (e) {
      log(`soccer skipped: ${e.message}`);
    }
    // 2b) NHL (hockey board)
    try {
      const m = await espnFinals("icehockey", "nhl", dates);
      total += applyMap(
        snapshot.hockey?.games, m,
        (g) => [g.home, g.away],
        (g, s) => (g.final = s)
      );
      log(`nhl: ${m.size} finals`);
    } catch (e) {
      log(`nhl skipped: ${e.message}`);
    }
    // 2c) MLB (odds board)
    try {
      const m = await espnFinals("baseball", "mlb", dates);
      total += applyMap(
        snapshot.odds?.sports?.baseball_mlb?.events, m,
        (e) => [e.home, e.away],
        (e, s) => (e.final = s)
      );
      log(`mlb: ${m.size} finals`);
    } catch (e) {
      log(`mlb skipped: ${e.message}`);
    }
    // 2d) WNBA + NCAAF (basketboard)
    try {
      const m = new Map();
      for (const slug of ["wnba", "ncaaf"]) {
        const x = await espnFinals("basketball", slug, dates);
        x.forEach((v, k) => m.set(k, v));
      }
      total += applyMap(
        snapshot.basketball?.games, m,
        (g) => [g.home, g.away],
        (g, s) => (g.final = s)
      );
      total += applyMap(
        snapshot.basketball?.forebet_today_all, m,
        (g) => {
          const [h, a] = String(g.match || "").split(/\sv\s/i);
          return [h, a];
        },
        (g, s) => (g.final = s)
      );
      log(`basketball: ${m.size} finals`);
    } catch (e) {
      log(`basketball skipped: ${e.message}`);
    }
  } else {
    log(`board date ${date} is >1 day old — skipping ESPN (history.json only)`);
  }
  log(`stamped ${total} finished matches`);
  return { stamped: total };
}

// CLI: stamp the already-written snapshot in place (used by the GH runner).
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.url ?? "");
if (isMain) {
  const OUT = path.join(process.cwd(), "lib", "data-snapshot.json");
  const snapshot = JSON.parse(fs.readFileSync(OUT, "utf8"));
  await stampFinals(snapshot);
  fs.writeFileSync(OUT, JSON.stringify(snapshot));
  console.log("snapshot re-stamped in place");
}
