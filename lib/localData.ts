import fs from "node:fs";
import path from "node:path";
import type { Prediction } from "@/lib/predictions";

/**
 * Local real-data feed.
 *
 * Reads the daily JSON files produced by the Python backend
 * (backend/app/daily/*.json) — forebet + model fusion for football,
 * forebet picks for basketball and tennis — and maps them into the
 * site's Prediction shape. No API key needed.
 */

const DAILY_DIR = path.join(process.cwd(), "backend", "app", "daily");

function dailyFiles(): string[] {
  try {
    return fs
      .readdirSync(DAILY_DIR)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

function loadLatest(suffix: string): any | null {
  const files = dailyFiles().filter((f) => f.endsWith(suffix));
  if (!files.length) return null;
  const p = path.join(DAILY_DIR, files[files.length - 1]);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const dec = (american?: number | null): string => {
  if (american == null) return "—";
  try {
    const d = american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
    return d.toFixed(2);
  } catch {
    return "—";
  }
};

// ---------- FOOTBALL (full-crack: forebet + model fusion, ~95 games/day) ----
function football(): Prediction[] {
  const files = dailyFiles();
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });
  let name: string | null = null;
  const todaysFull = files.find((f) => f.startsWith(today) && f.endsWith("_full_crack.json"));
  const todaysForebet = files.find((f) => f.startsWith(today) && f.endsWith("_forebet_football.json"));
  if (todaysFull) name = todaysFull;
  else if (todaysForebet) name = todaysForebet;
  else {
    const fc = files.filter((f) => f.endsWith("_full_crack.json"));
    if (fc.length) name = fc[fc.length - 1];
  }
  let rows: any = null;
  if (name) {
    try {
      rows = JSON.parse(fs.readFileSync(path.join(DAILY_DIR, name), "utf8"));
    } catch {
      rows = null;
    }
  }
  if (!Array.isArray(rows)) return [];
  const out: Prediction[] = [];
  rows.forEach((r: any, i: number) => {
    if (!r || !r.home || !r.away) return;
    const final = r.final || r.fb_pick || "";
    if (!final) return;
    const m = r.model || {};
    const bank = m.bank || "";
    const confidence: Prediction["confidence"] =
      bank === "BANKER" ? "High" : bank === "ODD" || r.src === "FOREBET" ? "Balanced" : "Value";
    let odds = "—";
    if (r.mkt_dec != null) {
      odds = Number(r.mkt_dec).toFixed(2);
    } else if (Array.isArray(r.fb_pct) && r.fb_pct.length === 3) {
      const pickNum = Number(String(final).charAt(0));
      const p =
        final === "1" ? r.fb_pct[0] : final === "2" ? r.fb_pct[2] : r.fb_pct[1];
      if (p > 0) odds = (100 / p).toFixed(2);
    }
    const bits: string[] = [];
    const hasFb =
      Array.isArray(r.fb_pct) && r.fb_pct.length === 3 && r.fb_pct.some((x: number) => x > 0);
    if (hasFb) {
      bits.push(`Forebet ${r.fb_pct[0]}% / ${r.fb_pct[1]}% / ${r.fb_pct[2]}% (1/X/2).`);
    }
    if (r.fb_pick) bits.push(`Forebet pick: ${r.fb_pick}.`);
    if (r.fb_score) bits.push(`Predicted score ${r.fb_score}.`);
    if (m.pick) bits.push(`Model: ${m.p ? `${m.p[0]}% / ${m.p[1]}% / ${m.p[2]}%` : ""} → ${m.pick}.`);
    if (r.ou) bits.push(`Total: ${r.ou}.`);
    if (r.note) bits.push(r.note);
    out.push({
      id: `fb-${i}`,
      sport: "football",
      league: r.lg || "Football",
      home: r.home,
      away: r.away,
      kickoff: `Today · ${r.t || ""} WAT`,
      market: r.ou ? "Over / Under" : "1X2 (match winner)",
      tip: String(final).replace(/^1$/, "Home (1)").replace(/^2$/, "Away (2)").replace(/^X$/, "Draw (X)"),
      confidence,
      odds,
      banker: hasFb && Math.max(r.fb_pct[0], r.fb_pct[1], r.fb_pct[2]) >= 70,
      analysis: bits.join(" "),
    });
  });
  return out;
}

// ---------- BASKETBALL (forebet picks + deep-crack fusion) ------------------
function basketball(): Prediction[] {
  const d = loadLatest("_basketball.json");
  if (!d) return [];
  const out: Prediction[] = [];
  const seen = new Set<string>();
  (d.games || []).forEach((g: any, i: number) => {
    if (!g || !g.home || !g.away) return;
    const key = `${g.home}|${g.away}`;
    seen.add(key);
    out.push({
      id: `bb-${i}`,
      sport: "basketball",
      league: g.league || "Basketball",
      home: g.home,
      away: g.away,
      kickoff: `Today · ${g.t || ""} WAT`,
      market: "Moneyline",
      tip: g.pick || g.fb_pick || "",
      confidence:
        g.conf && /HIGH/.test(g.conf) ? "High" : g.conf && /SPLIT|LOW/.test(g.conf) ? "Value" : "Balanced",
      banker: !!g.conf && /HIGH/.test(g.conf) && !/SPLIT/.test(g.conf),
      odds: g.fb_coef ? dec(Number(String(g.fb_coef).split(/[\s/]+/).find((s) => /^[+-]?\d+$/.test(s)))) : "—",
      analysis: [
        g.fb_prob ? `Forebet ${g.fb_prob[0]}% / ${g.fb_prob[1]}%.` : "Not covered by Forebet.",
        g.fb_score ? `Forebet score ${g.fb_score}.` : "",
        g.why || "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  });
  // remaining forebet rows (league games without a deep-crack)
  (d.forebet_today_all || []).forEach((g: any, i: number) => {
    if (!g || !g.match) return;
    const [home, away] = String(g.match).split(/\sv\s/i);
    if (!home || !away) return;
    if (seen.has(`${home}|${away}`)) return;
    const prob = String(g.prob || "").split("/");
    out.push({
      id: `bbf-${i}`,
      sport: "basketball",
      league: g.league || "Basketball",
      home,
      away,
      kickoff: `Today · ${g.t || ""} WAT`,
      market: "Moneyline",
      tip: g.pred === "1" ? `Home (${home})` : `Away (${away})`,
      confidence: prob.length === 2 && Number(prob[0] === "53" ? prob[0] : prob[0]) >= 60 ? "Balanced" : "Balanced",
      odds: g.coef ? dec(Number(String(g.coef).split(/[\s/]+/).find((s) => /^[+-]?\d+$/.test(s)))) : "—",
      analysis: [
        `Forebet ${g.prob || ""}%.`,
        g.score ? `Forebet score ${g.score}.` : "",
        g.status ? `Status: ${g.status}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  });
  return out;
}

// ---------- TENNIS (forebet picks + set scores) ------------------------------
function tennis(): Prediction[] {
  const d = loadLatest("_tennis.json");
  if (!d) return [];
  const out: Prediction[] = [];
  (d.games || []).forEach((g: any, i: number) => {
    if (!g || !g.p1 || !g.p2) return;
    const coefStr = String(g.coef || "");
    const am = coefStr.match(/(-?\d{3,4})/);
    out.push({
      id: `tn-${i}`,
      sport: "tennis",
      league: g.tourn || "Tennis",
      home: g.p1,
      away: g.p2,
      kickoff: `Today · ${g.t || ""} WAT`,
      market: "Match winner",
      tip: g.pred || "",
      confidence: g.note && /BANKER/i.test(g.note) ? "High" : g.note && /SPLIT/i.test(g.note) ? "Value" : "Balanced",
      banker: !!g.note && /BANKER/i.test(g.note),
      odds: am ? dec(Number(am[1])) : "—",
      analysis: [
        `Forebet ${g.prob || ""} (player 1 / player 2).`,
        g.sets ? `Predicted sets ${g.sets}.` : "",
        g.note ? g.note + "." : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  });
  return out;
}

/** All local predictions across the three sports (empty if no daily data yet). */
export function loadLocalPredictions(): Prediction[] {
  return [...football(), ...basketball(), ...tennis()];
}
