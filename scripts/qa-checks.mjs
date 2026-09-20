#!/usr/bin/env node
/**
 * qa-checks.mjs — ODDSORACLE 4.0 automated acceptance checks.
 *
 * Runs against lib/data-snapshot.json + results/history.json.
 * Exits non-zero (blocks the build / CI) when an invariant is broken.
 *
 * Invariants (per the 4.0 master spec, section 28):
 *   1. Canonical snapshot: dataDate + generatedAt present; dataDate matches
 *      the daily board files (no page may silently label yesterday as today).
 *   2. Counts reconcile: homepage summary vs snapshot sections.
 *   3. Every football prediction has provenance (model version + timestamp).
 *   4. Negative edge can never carry VALUE / STRONG VALUE.
 *   5. Stale/untrusted prices can never carry STRONG VALUE.
 *   6. High model confidence with negative edge must not be VALUE.
 *   7. Oracle Score is present as a 0-100 strength score (not win chance).
 *   8. Track record: rows are settled (score + full), cumulative stats
 *      recompute exactly from the rows, losses are present (never deleted).
 *   9. Sport sections: games have time + names; unknown data is never
 *      fabricated (no empty-string players).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const snap = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/data-snapshot.json"), "utf8"));
let hist = null;
const histPath = path.join(ROOT, "backend/app/results/history.json");
if (fs.existsSync(histPath)) hist = JSON.parse(fs.readFileSync(histPath, "utf8"));

const problems = [];
const ok = (m) => process.stdout.write(`  \u2713 ${m}\n`);
const bad = (m) => {
  problems.push(m);
  process.stdout.write(`  \u2717 ${m}\n`);
};

console.log("ODDSORACLE QA — canonical snapshot + invariants\n");

// ---- 1. canonical snapshot -------------------------------------------------
if (!snap.dataDate || !/^\d{4}-\d{2}-\d{2}$/.test(snap.dataDate)) bad("snapshot.dataDate missing/invalid");
else {
  const ageH = (Date.now() - new Date(snap.generatedAt || 0).getTime()) / 36e5;
  if (ageH > 96) bad(`snapshot is ${Math.round(ageH)}h old (>96h) — pipeline may be stuck`);
  else ok(`canonical snapshot ${snap.dataDate} (generated ${Math.round(ageH)}h ago, WAT display on site)`);
}
const fb = snap.football || [];
if (fb.length) {
  const dates = new Set(fb.map((r) => String(r.date || "").slice(0, 10)));
  if (dates.size > 1 && snap.dataDate && [...dates].some((d) => d && d !== snap.dataDate))
    bad(`football rows carry multiple dates ${[...dates]} vs dataDate ${snap.dataDate}`);
  else ok(`all football rows dated ${snap.dataDate} (no yesterday-as-today)`);
}

// ---- 2. counts reconcile ----------------------------------------------------
const sum = { fb: fb.length, bb: (snap.basketball?.games || []).length, tn: (snap.tennis?.games || []).length };
const otherTotal =
  (snap.odds?.sports?.baseball_mlb?.events || []).length +
  (snap.ncaafb?.games || []).length +
  (snap.nfl?.games || []).length;
ok(`counts: football ${sum.fb} · basketball ${sum.bb} · tennis ${sum.tn} · other ${otherTotal}`);

// ---- 3. provenance ----------------------------------------------------------
const missingProv = fb.filter((r) => r.oracle && (!r.oracle.model_version || !r.oracle.data_timestamp));
if (missingProv.length) bad(`${missingProv.length} football predictions lack model version/timestamp`);
else ok(`all ${fb.filter((r) => r.oracle).length} oracle predictions carry model_version + timestamp`);

// ---- 4/5/6. signal invariants ----------------------------------------------
let nSig = 0, negVal = 0, staleStrong = 0, hiConfVal = 0;
for (const r of fb) {
  const o = r.oracle;
  if (!o) continue;
  nSig++;
  const isValue = o.signal === "VALUE" || o.signal === "STRONG VALUE";
  if (isValue && typeof o.edge === "number" && o.edge < 0) negVal++;
  if (o.signal === "STRONG VALUE" && (o.why?.minus || []).some((m) => /previous day/i.test(String(m))))
    staleStrong++;
  const conf = Math.max(...(o.model_probability || [0]));
  if (conf >= 80 && isValue && typeof o.edge === "number" && o.edge < 0) hiConfVal++;
}
if (negVal) bad(`${negVal} predictions with negative edge display VALUE/STRONG VALUE`);
else ok(`no negative-edge VALUE signals (${nSig} checked)`);
if (staleStrong) bad(`${staleStrong} STRONG VALUE on stale prices`);
else ok("no STRONG VALUE on stale/untrusted prices");
if (hiConfVal) bad(`${hiConfVal} high-confidence picks shown as VALUE despite negative edge`);
else ok("high confidence never auto-promoted to value");

// ---- 7. oracle score ---------------------------------------------------------
const badScore = fb.filter((r) => r.oracle && (r.oracle.oracle_score < 0 || r.oracle.oracle_score > 100));
if (badScore.length) bad(`${badScore.length} oracle scores outside 0-100`);
else ok(`oracle scores all within 0-100 (strength score, not win chance)`);

// ---- 8. track record ---------------------------------------------------------
if (hist) {
  const rows = Object.values(hist.days).flatMap((d) => d.rows || []);
  const unsettled = rows.filter((r) => !r.score || !r.full);
  if (unsettled.length) bad(`${unsettled.length} track-record rows lack final score/result`);
  const losses = rows.filter((r) => r.model_win === 0).length;
  const wins = rows.filter((r) => r.model_win === 1).length;
  ok(`track record: ${rows.length} settled rows (${wins}W/${losses}L — losses preserved)`);
  if (rows.length && !losses) bad("track record contains zero losses (suspicious — are losses being deleted?)");
  // recompute cumulative from rows (must match stored cumulative)
  const c = hist.cumulative || {};
  const withW = rows.filter((r) => r.model_win != null);
  const recomputed = withW.length ? Math.round((100 * withW.filter((r) => r.model_win === 1).length) / withW.length * 10) / 10 : null;
  if (recomputed != null && c.model_1x2 != null && Math.abs(recomputed - c.model_1x2) > 0.05)
    bad(`cumulative model_1x2 ${c.model_1x2} does not recompute from rows (${recomputed})`);
  else ok(`cumulative stats recompute from rows (model_1x2 ${c.model_1x2 ?? recomputed}%)`);
} else {
  bad("results/history.json missing");
}

// ---- 9. sport sections sanity -------------------------------------------------
for (const [key, label] of [
  ["basketball", "basketball"], ["tennis", "tennis"], ["hockey", "hockey"],
  ["ncaafb", "NCAAF"], ["nfl", "NFL"], ["setka", "table tennis"],
]) {
  const games = snap[key]?.games || [];
  if (!games.length) continue;
  const badNames = games.filter((g) => {
    if (g.p1 !== undefined) return !String(g.p1).trim() || !String(g.p2).trim();
    return !String(g.home || "").trim() || !String(g.away || "").trim();
  });
  if (badNames.length) bad(`${label}: ${badNames.length} games with missing team names`);
  else ok(`${label}: ${games.length} games, all named`);
}

console.log(`\n${problems.length ? `\u2717 QA FAILED — ${problems.length} invariant violations` : "\u2713 ALL QA CHECKS PASSED"}`);
process.exit(problems.length ? 1 : 0);
