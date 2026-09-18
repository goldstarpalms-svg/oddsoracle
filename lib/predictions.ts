export type Sport = "football" | "basketball" | "tennis" | "other";

export type Confidence = "High" | "Balanced" | "Value";

export interface Prediction {
  id: string;
  sport: Sport;
  league: string;
  home: string;
  away: string;
  kickoff: string; // human readable label, e.g. "Today · 14:00"
  market: string;
  tip: string;
  confidence: Confidence;
  odds: string;
  analysis: string;
  banker?: boolean; // flagged safe pick (🏦)
}

export const SPORTS: Record<
  Sport,
  { label: string; singular: string; slug: string; blurb: string }
> = {
  football: {
    label: "Football",
    singular: "Football match",
    slug: "football",
    blurb:
      "1X2, over/under, both teams to score and accumulator building blocks across the top European leagues and global cup competitions.",
  },
  basketball: {
    label: "Basketball",
    singular: "Basketball game",
    slug: "basketball",
    blurb:
      "Point spreads, totals (over/under) and moneyline picks across the NBA, EuroLeague and international leagues.",
  },
  tennis: {
    label: "Tennis",
    singular: "Tennis match",
    slug: "tennis",
    blurb:
      "Match winner and set-score markets across ATP, WTA, Davis Cup and Challenger draws — plus Setka Cup table tennis via the Sekta app (sekta-cup/).",
  },
  other: {
    label: "More Sports",
    singular: "Fixture",
    slug: "other",
    blurb:
      "Ice hockey, esports, MMA and niche markets when the value is on the board.",
  },
};

const SPORT_ORDER: Sport[] = ["football", "basketball", "tennis", "other"];

export const PREDICTIONS: Prediction[] = [
  // ---------------- FOOTBALL ----------------
  {
    id: "fb-01",
    sport: "football",
    league: "Premier League",
    home: "Manchester City",
    away: "Arsenal",
    kickoff: "Today · 16:30",
    market: "Both Teams To Score",
    tip: "YES",
    confidence: "High",
    odds: "1.70",
    analysis:
      "Two of the strongest attacking units in the division meet, with both sides creating high-volume chances and defending higher lines. Four of the last five head-to-heads saw both teams score, and neither side registered a clean sheet in their previous league outing.",
  },
  {
    id: "fb-02",
    sport: "football",
    league: "La Liga",
    home: "Real Madrid",
    away: "Sevilla",
    kickoff: "Today · 20:00",
    market: "Over / Under 2.5 Goals",
    tip: "Over 2.5",
    confidence: "High",
    odds: "1.60",
    analysis:
      "Madrid score freely at home and have cleared the 2.5 mark in most home fixtures this campaign. Sevilla's away games have trended open, averaging above three combined goals, with both sides pushing for a result that keeps the pressure on the top four.",
  },
  {
    id: "fb-03",
    sport: "football",
    league: "Serie A",
    home: "Inter Milan",
    away: "Napoli",
    kickoff: "Tomorrow · 19:45",
    market: "Match Result (1X2)",
    tip: "Home Win",
    confidence: "Balanced",
    odds: "2.10",
    analysis:
      "Inter's home record is among the league's best and their midfield has controlled possession in recent weeks. Napoli arrive in patchy away form, conceding in six of their last eight on the road. A tight game, but the home side carries the edge in quality and momentum.",
  },
  {
    id: "fb-04",
    sport: "football",
    league: "Bundesliga",
    home: "Bayern Munich",
    away: "Bayer Leverkusen",
    kickoff: "Today · 17:30",
    market: "Match Result (1X2)",
    tip: "Home Win",
    confidence: "High",
    odds: "1.55",
    analysis:
      "Bayern remain ruthless at the Allianz, and their attacking numbers are the best in the division. Leverkusen are dangerous on the counter but their defence has been breached repeatedly on the road against top-tier sides. Expect the hosts to create and convert enough chances.",
  },
  {
    id: "fb-05",
    sport: "football",
    league: "Ligue 1",
    home: "PSG",
    away: "Marseille",
    kickoff: "Today · 20:45",
    market: "Over / Under 2.5 Goals",
    tip: "Over 2.5",
    confidence: "High",
    odds: "1.62",
    analysis:
      "Le Classique has a strong recent history of open, eventful games. PSG's attacking depth and Marseille's willingness to commit men forward both point to goals. Both teams scored in the last three meetings.",
  },
  {
    id: "fb-06",
    sport: "football",
    league: "Champions League",
    home: "Barcelona",
    away: "Atletico Madrid",
    kickoff: "Upcoming",
    market: "Both Teams To Score",
    tip: "YES",
    confidence: "Balanced",
    odds: "1.72",
    analysis:
      "A tactical matchup with goals on both ends. Barcelona create from wide areas while Atletico are lethal in transition. Set-piece and defensive lapses on either side have been consistent themes this season.",
  },
  {
    id: "fb-07",
    sport: "football",
    league: "African Champions League",
    home: "Golden Lions FC",
    away: "Riverside United",
    kickoff: "Today · 18:00",
    market: "Match Result (1X2)",
    tip: "Home Win",
    confidence: "Balanced",
    odds: "1.95",
    analysis:
      "The home side are unbeaten in their last five and boast the league's leading scorer. Riverside's away record is concerning, having failed to win in their last seven on the road. Home advantage and form make the hosts the value pick.",
  },
  {
    id: "fb-08",
    sport: "football",
    league: "Africa Cup Qualifiers",
    home: "Super Eagles XI",
    away: "Desert Falcons",
    kickoff: "Today · 17:00",
    market: "Over 1.5 Goals",
    tip: "YES",
    confidence: "Balanced",
    odds: "1.48",
    analysis:
      "Both outfits are in must-win territory, which tends to produce open, attacking football from the whistle. Combined recent fixtures have averaged well over 1.5 goals, with the home side scoring in every competitive game this cycle.",
  },

  // ---------------- BASKETBALL ----------------
  {
    id: "bk-01",
    sport: "basketball",
    league: "NBA",
    home: "Los Angeles Lakers",
    away: "Golden State Warriors",
    kickoff: "Today · 03:30",
    market: "Total Points Over/Under",
    tip: "Over 226.5",
    confidence: "High",
    odds: "1.85",
    analysis:
      "Both teams rank among the fastest paces in the league and shoot a high volume from three. Recent meetings have trended well above the total, and there is no injury concern on either scoring core.",
  },
  {
    id: "bk-02",
    sport: "basketball",
    league: "NBA",
    home: "Boston Celtics",
    away: "Miami Heat",
    kickoff: "Tomorrow · 01:00",
    market: "Point Spread",
    tip: "Celtics -6.5",
    confidence: "High",
    odds: "1.90",
    analysis:
      "Boston's home net rating is elite and they close halves well defensively. Miami have struggled to sustain scoring against top-ten defences and are missing key rotation minutes. The spread looks generous.",
  },
  {
    id: "bk-03",
    sport: "basketball",
    league: "EuroLeague",
    home: "Real Madrid Basketball",
    away: "Olympiacos",
    kickoff: "Today · 19:00",
    market: "Match Winner",
    tip: "Home Win",
    confidence: "Balanced",
    odds: "1.70",
    analysis:
      "Madrid's home court record is formidable and they control tempo through the paint. Olympiacos travel well but have dropped close road games against elite rebounding sides. Home win with modest margin is the call.",
  },
  {
    id: "bk-04",
    sport: "basketball",
    league: "Basketball Africa League",
    home: "Lagos Raiders",
    away: "Coastal Kings",
    kickoff: "Today · 18:30",
    market: "Total Points Over/Under",
    tip: "Over 168.5",
    confidence: "Balanced",
    odds: "1.80",
    analysis:
      "A fast-paced matchup between two transition-heavy sides. Neither team defends the three at a high level, and both push the ball after makes — conditions that consistently produce overs in this league.",
  },

  // ---------------- TENNIS ----------------
  {
    id: "tn-01",
    sport: "tennis",
    league: "ATP Tour",
    home: "Novak Djokovic",
    away: "Jannik Sinner",
    kickoff: "Today · 15:00",
    market: "Match Winner",
    tip: "Sinner",
    confidence: "High",
    odds: "1.65",
    analysis:
      "Sinner arrives in career-best form, winning the vast majority of his matches on hard court this year and serving at a high level. Djokovic's recent return helps, but age and match-sharpness favour the younger player on the faster surface.",
  },
  {
    id: "tn-02",
    sport: "tennis",
    league: "WTA Tour",
    home: "Iga Swiatek",
    away: "Aryna Sabalenka",
    kickoff: "Today · 13:00",
    market: "Match Winner",
    tip: "Swiatek",
    confidence: "Balanced",
    odds: "1.85",
    analysis:
      "A coin-flip matchup on paper, but Swiatek's consistency on this surface and recent dominance in their previous meeting edge it. Expect three sets, with the world-class return game proving the difference.",
  },
  {
    id: "tn-03",
    sport: "tennis",
    league: "Challenger",
    home: "Carlos Alcaraz",
    away: "Holger Rune",
    kickoff: "Tomorrow · 16:00",
    market: "Total Games Over/Under",
    tip: "Over 21.5",
    confidence: "Balanced",
    odds: "1.75",
    analysis:
      "Both players produce long rallies and hold serve on a high percentage of points. Head-to-head history points to a close, high-tempo contest that should comfortably clear the total games line.",
  },

  // ---------------- MORE SPORTS ----------------
  {
    id: "ot-01",
    sport: "other",
    league: "NHL",
    home: "Toronto Maple Leafs",
    away: "Boston Bruins",
    kickoff: "Today · 01:00",
    market: "Match Winner",
    tip: "Home Win",
    confidence: "Balanced",
    odds: "1.95",
    analysis:
      "Toronto's power play has been among the league's most efficient and Boston are shorthanded on the back end. At home, with the extra-man edge, the hosts are the value play."
  },
  {
    id: "ot-02",
    sport: "other",
    league: "UFC",
    home: "Alex Pereira",
    away: "Magomed Ankalaev",
    kickoff: "Upcoming",
    market: "Match Result",
    tip: "Ankalaev",
    confidence: "Balanced",
    odds: "1.72",
    analysis:
      "A stylistic clash that favours disciplined pressure over a single-tool power game. Ankalaev's wrestling and volume should neutralise the striking threat over five rounds and control the pace."
  },
];

// Helpers
export function bySport(sport: Sport): Prediction[] {
  return PREDICTIONS.filter((p) => p.sport === sport);
}

export function featured(count = 6): Prediction[] {
  return PREDICTIONS.slice(0, count);
}

export function sportList(): { sport: Sport; label: string; slug: string; blurb: string; count: number }[] {
  return SPORT_ORDER.map((sport) => ({
    sport,
    ...SPORTS[sport],
    count: bySport(sport).length,
  }));
}
