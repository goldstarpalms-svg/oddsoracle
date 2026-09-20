import { oracleBoardRows } from "./rich";
import { loadPulseDoc, type PulsePick } from "./localData";
import {
  classifyValue,
  confidenceOf,
  dataQuality,
  evPct,
  oddsFreshness,
  type DataQuality,
  type PredictionStatus,
  type ValueClass,
} from "./value";

/**
 * Normalised board event — the shape the whole terminal renders.
 *
 * Two engines can cover the same event (the Oracle engine and Pulse-Bet). We
 * merge them into ONE row so an event is never listed twice, keep the primary
 * model number in the table columns, and expose the second engine as a
 * cross-check inside the detail panel. Nothing is averaged in secret.
 */

export type EngineProb = { prob: number | null; label: string; version: string };

export type BoardEvent = {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  selection: string;
  marketLabel: string;

  modelProb: number | null;      // 0–1
  marketProb: number | null;     // 0–1 (de-vigged where the data allows)
  rawImplied: number | null;     // 1/odds, no adjustment
  edgePp: number | null;         // percentage points
  ev: number | null;             // fraction
  odds: number | null;

  valueClass: ValueClass;
  quality: { level: DataQuality; score: number; reasons: string[] };
  confidence: { level: "High" | "Medium" | "Low"; note: string };
  status: PredictionStatus;

  modelVersion: string;
  updatedAt: string;
  freshness: { label: string; stale: boolean; minutes: number | null };

  /** Every entry here was actually computed — the UI may show these as-is. */
  inputs: { label: string; value: string }[];
  /** Short evidence bullets, generated from real inputs only. */
  evidence: string[];

  engines: EngineProb[];
  slugKey: string;
};

const norm = (s: string) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);

function parseEvent(event: string): [string, string] {
  const parts = String(event || "").split(/\s+v\s+/i);
  if (parts.length === 2) return [parts[0].trim(), parts[1].trim()];
  return [String(event || "").trim(), ""];
}

/**
 * Status is only claimed when we actually know it. `prices_live` means the
 * prices came from a live feed — it does NOT mean the match is in play, so it
 * must never be rendered as LIVE. Until we have a real in-play source, a match
 * is UPCOMING or SETTLED and nothing else.
 */
function statusOf(finished: boolean): PredictionStatus {
  return finished ? "SETTLED" : "UPCOMING";
}

export function buildBoard(): BoardEvent[] {
  const oracle = oracleBoardRows();
  const pulseDoc = loadPulseDoc();
  const pulse = (pulseDoc?.picks || []).filter((p) => p.sport === "football") as PulsePick[];

  const byKey = new Map<string, BoardEvent>();
  const now = Date.now();

  // ---- Oracle engine rows -------------------------------------------------
  for (const r of oracle) {
    const [home, away] = parseEvent(r.event);
    const key = `football:${norm(home)}|${norm(away)}`;

    const q = dataQuality({
      hasOdds: !!r.odds && r.odds > 1,
      hasMarket: Array.isArray(r.marketFull) && r.marketFull.length === 3,
      hasModel: Array.isArray(r.modelFull) && r.modelFull.length === 3,
      books: null,
      sampleMatches: null,
      oddsAgeMinutes: r.ts ? (now - new Date(r.ts).getTime()) / 60000 : null,
    });

    const modelProb = r.modelProb / 100;
    const marketProb = r.marketProb == null ? null : r.marketProb / 100;
    const odds = r.odds && r.odds > 1 ? r.odds : null;
    const edgePp = typeof r.edge === "number" ? r.edge : null;
    const conf = confidenceOf(q, edgePp);

    const inputs: { label: string; value: string }[] = [];
    if (Array.isArray(r.modelFull) && r.modelFull.length === 3)
      inputs.push({ label: "Model 1X2", value: r.modelFull.map((x) => `${x}%`).join(" / ") });
    if (Array.isArray(r.marketFull) && r.marketFull.length === 3)
      inputs.push({ label: "Market 1X2 (de-vigged)", value: r.marketFull.map((x) => `${x}%`).join(" / ") });
    if (r.consensus && r.consensus !== "—")
      inputs.push({ label: "Model consensus", value: `${r.consensus} sub-models agree` });
    if (r.oracleScore) inputs.push({ label: "Oracle score", value: r.oracleScore.toFixed(1) });
    if (Array.isArray(r.mcTop) && r.mcTop.length)
      inputs.push({ label: "Most likely scoreline (simulation)", value: r.mcTop.join(", ") });

    const evidence: string[] = [];
    (r.whyPlus || []).slice(0, 4).forEach((w) => evidence.push(`For: ${w}`));
    (r.whyMinus || []).slice(0, 3).forEach((w) => evidence.push(`Against: ${w}`));

    byKey.set(key, {
      id: r.id || key,
      sport: "football",
      league: r.league,
      home: home || r.event,
      away,
      kickoff: r.time,
      market: r.market,
      selection: r.selection,
      marketLabel: r.selLabel || r.selection,
      modelProb,
      marketProb,
      rawImplied: odds ? 1 / odds : null,
      edgePp,
      ev: evPct(modelProb, odds),
      odds,
      valueClass: classifyValue(edgePp, q.level),
      quality: q,
      confidence: conf,
      status: statusOf(!!(r as any).finished),
      modelVersion: r.modelVersion || "—",
      updatedAt: r.ts || "",
      freshness: oddsFreshness(r.ts || null, now),
      inputs,
      evidence,
      engines: [
        { prob: modelProb, label: "Oracle", version: r.modelVersion || "oracle" },
      ],
      slugKey: key,
    });
  }

  // ---- Pulse-Bet enrichment ----------------------------------------------
  for (const p of pulse) {
    const key = `football:${norm(p.home)}|${norm(p.away)}`;
    const existing = byKey.get(key);

    const q = dataQuality({
      hasOdds: !!p.price,
      hasMarket: !!p.p_market,
      hasModel: !!p.p_pulse || !!p.p_blended,
      hasForebet: !!p.p_forebet,
      books: null,
      sampleMatches: null,
      oddsAgeMinutes: null,
    });

    const edgePp = p.edge == null ? null : p.edge * 100;

    // If the Oracle engine already owns this event, Pulse becomes a cross-check.
    if (existing) {
      existing.engines.push({
        prob: p.model_prob ?? null,
        label: "Pulse-Bet",
        version: p.model_version || "pulse",
      });
      if (existing.odds == null && p.price) {
        existing.odds = p.price;
        existing.rawImplied = 1 / p.price;
        existing.ev = evPct(existing.modelProb, p.price);
      }
      if (p.p_pulse)
        existing.inputs.push({
          label: "Pulse Dixon-Coles 1X2",
          value: p.p_pulse.map((x) => `${Math.round(x * 100)}%`).join(" / "),
        });
      if (typeof p.ou25 === "number")
        existing.inputs.push({ label: "Over 2.5 goals (model)", value: `${Math.round(p.ou25 * 100)}%` });
      if (typeof p.btts === "number")
        existing.inputs.push({ label: "Both teams to score (model)", value: `${Math.round(p.btts * 100)}%` });
      if (p.reasoning) existing.evidence.push(`Pulse: ${p.reasoning}`);
      continue;
    }

    // Pulse-only event (no Oracle coverage)
    const selIdx = p.selection_code === "2" ? 2 : p.selection_code === "X" ? 1 : 0;
    const marketProb = p.p_market ? p.p_market[selIdx] : null;
    const odds = p.price;
    const conf = confidenceOf(q, edgePp);

    const inputs: { label: string; value: string }[] = [];
    if (p.p_pulse)
      inputs.push({ label: "Pulse Dixon-Coles 1X2", value: p.p_pulse.map((x) => `${Math.round(x * 100)}%`).join(" / ") });
    if (p.p_market)
      inputs.push({ label: "Market 1X2 (de-vigged)", value: p.p_market.map((x) => `${Math.round(x * 100)}%`).join(" / ") });
    if (p.p_forebet)
      inputs.push({ label: "Forebet 1X2", value: p.p_forebet.map((x) => `${Math.round(x * 100)}%`).join(" / ") });
    if (typeof p.ou25 === "number")
      inputs.push({ label: "Over 2.5 goals (model)", value: `${Math.round(p.ou25 * 100)}%` });
    if (typeof p.btts === "number")
      inputs.push({ label: "Both teams to score (model)", value: `${Math.round(p.btts * 100)}%` });

    byKey.set(key, {
      id: p.id || key,
      sport: "football",
      league: p.league,
      home: p.home,
      away: p.away,
      kickoff: p.kickoff,
      market: p.market,
      selection: p.selection_code || "1",
      marketLabel: p.selection,
      modelProb: p.model_prob ?? null,
      marketProb,
      rawImplied: odds ? 1 / odds : null,
      edgePp,
      ev: evPct(p.model_prob, odds),
      odds,
      valueClass: classifyValue(edgePp, q.level),
      quality: q,
      confidence: conf,
      status: "UPCOMING",
      modelVersion: p.model_version || "pulse",
      updatedAt: pulseDoc?.generated_at || "",
      freshness: oddsFreshness(pulseDoc?.generated_at || null, now),
      inputs,
      evidence: p.reasoning ? [p.reasoning] : [],
      engines: [{ prob: p.model_prob ?? null, label: "Pulse-Bet", version: p.model_version || "pulse" }],
      slugKey: key,
    });
  }

  return Array.from(byKey.values());
}
