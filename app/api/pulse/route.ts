import { NextResponse } from "next/server";
import { loadPulseArbs, loadPulseDoc, loadPulsePicks } from "@/lib/localData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pulse-Bet enrichment API.
 *
 * Two modes:
 *  1. LIVE  — set PULSE_API_URL (the FastAPI service in pulse-bet/dashboard).
 *             We fetch /picks and /arbs at request time and return fresh data.
 *  2. BUILD — no PULSE_API_URL: serve the snapshot bundled by
 *             scripts/bundle-data.mjs from backend/app/daily/<DATE>_pulse.json.
 *
 * Mode 2 is the default so the site never breaks when the engine is down.
 */

const UPSTREAM = process.env.PULSE_API_URL?.replace(/\/$/, "") || "";
const TIMEOUT_MS = 4000;

async function getJson(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sport = url.searchParams.get("sport");
  const tier = url.searchParams.get("tier");
  const bettableOnly = url.searchParams.get("bettable") === "1";

  let doc = loadPulseDoc();
  let arbs = loadPulseArbs();
  let mode: "live" | "snapshot" = "snapshot";

  if (UPSTREAM) {
    const [livePicks, liveArbs] = await Promise.all([
      getJson(`${UPSTREAM}/picks`),
      getJson(`${UPSTREAM}/arbs`),
    ]);
    if (livePicks?.picks?.length) {
      doc = livePicks;
      mode = "live";
    }
    if (liveArbs?.arbs) arbs = liveArbs;
  }

  let picks = doc?.picks ?? [];
  if (sport) picks = picks.filter((p) => p.sport === sport);
  if (tier) picks = picks.filter((p) => p.tier === tier.toUpperCase());
  if (bettableOnly) picks = picks.filter((p) => p.bettable);

  return NextResponse.json(
    {
      mode,
      date: doc?.date ?? null,
      generated_at: doc?.generated_at ?? null,
      model_version: doc?.model_version ?? null,
      bankroll_ngn: doc?.bankroll_ngn ?? null,
      kelly_fraction: doc?.kelly_fraction ?? null,
      coverage: doc?.coverage ?? null,
      tiers: doc?.tiers ?? null,
      count: picks.length,
      picks,
      arbs: arbs?.arbs ?? [],
      watch: arbs?.watch ?? [],
      disclaimer:
        "Estimates, not guarantees. 18+ — only stake what you can afford to lose.",
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
