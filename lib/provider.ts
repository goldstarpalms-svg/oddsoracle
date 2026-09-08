import type { OddsEvent } from "@/lib/engine";

// Target sport keys to pull, in priority order. Tweak FEATURED_SPORT_KEYS to
// control which leagues appear. Each key costs one API request.
export const FEATURED_SPORT_KEYS = [
  "soccer_epl",
  "soccer_la_liga",
  "soccer_serie_a",
  "soccer_uefa_champs_league",
  "basketball_nba",
  "basketball_euroleague",
  "tennis_atp",
  "tennis_wta",
];

const API = "https://api.the-odds-api.com/v4";

function sportOf(key: string): OddsEvent["sport"] {
  if (key.startsWith("soccer")) return "football";
  if (key.startsWith("basketball")) return "basketball";
  if (key.startsWith("tennis")) return "tennis";
  return "other";
}

function leagueOf(key: string): string {
  const map: Record<string, string> = {
    soccer_epl: "Premier League",
    soccer_la_liga: "La Liga",
    soccer_serie_a: "Serie A",
    soccer_bundesliga: "Bundesliga",
    soccer_liga1: "Ligue 1",
    soccer_uefa_champs_league: "Champions League",
    basketball_nba: "NBA",
    basketball_euroleague: "EuroLeague",
    tennis_atp: "ATP Tour",
    tennis_wta: "WTA Tour",
  };
  return map[key] || key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickBookmaker(bookmakers: { key: string; markets: any[] }[]) {
  // Prefer a sharp, widely-available book; fall back to the first with data.
  const order = ["bet365", "pinnacle", "betfair", "unibet", "williamhill", "draftkings"];
  const chosen = (order.map((k) => bookmakers.find((b) => b.key === k)).filter(Boolean) as any[])[0];
  return chosen || bookmakers[0];
}

function extractH2H(markets: any[]): { name: string; price: number }[] {
  const m = markets.find((ma) => ma.key === "h2h");
  if (!m || !m.outcomes) return [];
  return m.outcomes.map((o: any) => ({ name: o.name, price: o.price }));
}

function extractTotals(markets: any[]): { name: string; price: number }[] {
  const m = markets.find((ma) => ma.key === "totals");
  if (!m || !m.outcomes) return [];
  return m.outcomes.map((o: any) => ({ name: o.name, price: o.price }));
}

/** Fetch upcoming events + odds from The Odds API. Returns [] when unset/failing. */
export async function fetchOdds(apiKey?: string): Promise<OddsEvent[]> {
  if (!apiKey) return [];
  const events: OddsEvent[] = [];

  for (const sportKey of FEATURED_SPORT_KEYS) {
    try {
      const url = `${API}/sports/${sportKey}/odds/?apiKey=${encodeURIComponent(
        apiKey,
      )}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;

      for (const game of data) {
        if (!game?.bookmakers?.length) continue;
        const bm = pickBookmaker(game.bookmakers);
        if (!bm?.markets) continue;
        const h2h = extractH2H(bm.markets);
        if (!h2h.length) continue;
        events.push({
          sportKey,
          league: leagueOf(sportKey),
          sport: sportOf(sportKey),
          home: game.home_team,
          away: game.away_team,
          commenceTime: game.commence_time,
          kickoffLabel: "",
          h2h,
          totals: extractTotals(bm.markets),
        });
      }
    } catch {
      // skip a failing sport, keep the rest
    }
  }

  return events;
}
