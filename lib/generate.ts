import type { Prediction } from "@/lib/predictions";
import { PREDICTIONS } from "@/lib/predictions";
import { fetchOdds } from "@/lib/provider";
import { buildPredictions } from "@/lib/engine";

export interface PredictionsResult {
  source: "live" | "fallback";
  updatedAt: string;
  predictions: Prediction[];
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: PredictionsResult | null = null;
let cacheAt = 0;

/**
 * Returns live predictions when an API key is configured, otherwise falls back
 * to the curated editorial picks. Cached for TTL to respect API limits and keep
 * the endpoint fast.
 */
export async function getPredictions(): Promise<PredictionsResult> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;

  const apiKey = process.env.THE_ODDS_API_KEY;

  try {
    const events = await fetchOdds(apiKey);
    if (events.length) {
      const predictions = buildPredictions(events);
      if (predictions.length) {
        cache = { source: "live", updatedAt: new Date().toISOString(), predictions };
        cacheAt = now;
        return cache;
      }
    }
  } catch {
    // fall through to editorial
  }

  // No key / no live data → use the curated editorial picks.
  const predictions = PREDICTIONS.map((p) => ({ ...p }));
  cache = { source: "fallback", updatedAt: new Date().toISOString(), predictions };
  cacheAt = now;
  return cache;
}

/** Bypass the cache (e.g. for a manual regenerate endpoint). */
export async function refreshPredictions(): Promise<PredictionsResult> {
  cache = null;
  cacheAt = 0;
  return getPredictions();
}
