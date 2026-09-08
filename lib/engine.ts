import type { Prediction, Sport, Confidence } from "@/lib/predictions";

// A normalized event coming from a data provider (e.g. The Odds API).
export interface OddsEvent {
  sportKey: string;
  league: string;
  sport: Sport;
  home: string;
  away: string;
  commenceTime: string; // ISO
  kickoffLabel: string; // human friendly, e.g. "Today · 16:30"
  // h2h outcomes: [{name, price}], devigged inside the engine.
  h2h: { name: string; price: number }[];
  // totals market (optional): [{name: "Over 2.5", price}]
  totals?: { name: string; price: number }[];
}

const LEAGUE_MAP: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_la_liga: "La Liga",
  soccer_serie_a: "Serie A",
  soccer_bundesliga: "Bundesliga",
  soccer_liga1: "Ligue 1",
  soccer_uefa_champs_league: "Champions League",
  soccer_fifa_world_cup: "World Cup",
  soccer_africa_cup: "Africa Cup of Nations",
  basketball_nba: "NBA",
  basketball_euroleague: "EuroLeague",
  basketball_wnba: "WNBA",
  basketball_liga: "National League",
  tennis_atp: "ATP Tour",
  tennis_wta: "WTA Tour",
  icehockey_nhl: "NHL",
};

function sportOf(key: string): Sport {
  if (key.startsWith("soccer")) return "football";
  if (key.startsWith("basketball")) return "basketball";
  if (key.startsWith("tennis")) return "tennis";
  return "other";
}

function leagueOf(key: string): string {
  return LEAGUE_MAP[key] || key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function marketLabel(sport: Sport, kind: "h2h" | "totals"): string {
  if (sport === "football") {
    return kind === "h2h" ? "Match Result (1X2)" : "Over / Under 2.5 Goals";
  }
  if (sport === "basketball") {
    return kind === "h2h" ? "Match Winner" : "Total Points Over/Under";
  }
  if (sport === "tennis") {
    return kind === "h2h" ? "Match Winner" : "Total Games Over/Under";
  }
  return kind === "h2h" ? "Match Result" : "Total";
}

// Remove bookmaker margin: convert decimal odds to "fair" probabilities.
function devig(outcomes: { name: string; price: number }[]): { name: string; fair: number; odds: number }[] {
  if (!outcomes.length) return [];
  const probs = outcomes.map((o) => 1 / o.price);
  const sum = probs.reduce((s, p) => s + p, 0);
  return outcomes.map((o, i) => ({
    name: o.name,
    fair: probs[i] / sum,
    odds: o.price,
  }));
}

function confidenceFrom(fair: number, odds: number): { confidence: Confidence; analysis: string } {
  const implied = 1 / odds;
  const edge = fair - implied; // positive = value relative to the price
  let confidence: Confidence;
  if (fair >= 0.62) confidence = "High";
  else if (fair >= 0.46) confidence = "Balanced";
  else confidence = "Value";

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const analysis = `The market model (devigged to strip the bookmaker margin) rates this selection at a fair probability of ${pct(fair)} against the quoted odds of ${odds.toFixed(2)} (implied ${pct(implied)}). ${
    edge > 0.03
      ? `That gives a positive edge of about ${pct(edge)}, which is why it stands out.`
      : `The numbers are close to the price, so it is a strong-lean rather than an absolute value play.`
  } ${confidence === "High" ? "High conviction on this one." : ""}`;

  return { confidence, analysis };
}

function friendlyKickoff(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hrs = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${sameDay ? "Today" : d.toLocaleDateString("en-GB", { weekday: "short" })} · ${hrs}`;
}

function pickFrom(
  event: OddsEvent,
  kind: "h2h" | "totals",
  outcomes: { name: string; price: number }[],
  id: string,
): Prediction | null {
  const fair = devig(outcomes);
  if (!fair.length) return null;
  // Pick the side with the highest fair probability (market favorite).
  const best = fair.reduce((a, b) => (b.fair > a.fair ? b : a));
  const { confidence, analysis } = confidenceFrom(best.fair, best.odds);

  return {
    id,
    sport: event.sport,
    league: event.league,
    home: event.home,
    away: event.away,
    kickoff: friendlyKickoff(event.commenceTime),
    market: marketLabel(event.sport, kind),
    tip: best.name,
    confidence,
    odds: best.odds.toFixed(2),
    analysis,
  };
}

/**
 * Core entry point: turns normalized odds events into Prediction objects.
 * Pure, deterministic, no network. This is what makes the site "predict".
 */
export function buildPredictions(events: OddsEvent[]): Prediction[] {
  const out: Prediction[] = [];
  const now = Date.now();

  for (const event of events) {
    if (new Date(event.commenceTime).getTime() < now - 5 * 60 * 1000) continue; // skip past
    const key = event.sportKey;

    const h2h = pickFrom(event, "h2h", event.h2h, `${event.sport}-${key}-${event.home}-${event.away}-h2h`);
    if (h2h) out.push(h2h);

    if (event.totals && event.totals.length) {
      const total = pickFrom(event, "totals", event.totals, `${event.sport}-${key}-${event.home}-${event.away}-tot`);
      if (total) out.push(total);
    }
  }

  // Sort: most confident first, then by kickoff.
  const order = { High: 0, Balanced: 1, Value: 2 } as const;
  out.sort((a, b) => {
    const c = order[a.confidence] - order[b.confidence];
    if (c !== 0) return c;
    return a.kickoff.localeCompare(b.kickoff);
  });

  return out;
}
