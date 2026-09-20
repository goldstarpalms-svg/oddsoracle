import SNAPSHOT from "./data-snapshot.json";
import { freshness, oracleBoardRows } from "./rich";
import { loadPulseDoc } from "./localData";
import { oddsFreshness, THRESHOLDS, classifyValue } from "./value";

/**
 * Real numbers only. Every KPI on the homepage is derived here from the
 * snapshot — nothing is hard-coded and nothing is inflated by counting the
 * same event twice through two engines.
 */

const norm = (s: string) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 24);

type Row = { sport: string; home?: string; away?: string; p1?: string; p2?: string };

function eventKeys(): Set<string> {
  const any = SNAPSHOT as any;
  const keys = new Set<string>();

  const addBoard = (rows: any[] | undefined, sport: string) => {
    (rows || []).forEach((r: Row) => {
      const h = norm((r.home || r.p1 || "") as string);
      const a = norm((r.away || r.p2 || "") as string);
      if (h && a) keys.add(`${sport}:${h}|${a}`);
    });
  };

  addBoard(any.football, "football");
  addBoard(any.basketball?.games, "basketball");
  addBoard(any.basketball?.forebet_today_all, "basketball");
  addBoard(any.tennis?.games, "tennis");
  addBoard(any.hockey?.games, "hockey");
  addBoard(any.handball?.games, "handball");
  addBoard(any.forebetBaseball?.games, "baseball");
  addBoard(any.ncaafb?.games, "americanfootball");
  addBoard(any.nfl?.games, "americanfootball");
  addBoard(any.setka?.games, "tabletennis");
  return keys;
}

/** Events in the live market feed, with honest freshness attached. */
function liveFeed() {
  const any = SNAPSHOT as any;
  const sports = (any.odds?.sports || {}) as Record<string, { events?: any[] }>;
  let count = 0;
  Object.values(sports).forEach((s) => {
    count += (s?.events || []).length;
  });
  const f = oddsFreshness(any.odds?.generatedAt || null);
  return { count, freshness: f };
}

/**
 * Events where our number disagrees with the market by >= 5pp.
 * Two engines can cover the same event (oracle + pulse) — we take the strongest
 * edge per event so the KPI counts events, not duplicate engine rows.
 */
function valueEvents(): number {
  const keys = new Set<string>();
  oracleBoardRows().forEach((r: any) => {
    if (typeof r.edge === "number" && r.edge >= THRESHOLDS.valueMinPp) {
      keys.add(`football:${norm(r.event || "")}`);
    }
  });
  const pulse = loadPulseDoc();
  (pulse?.picks || []).forEach((p: any) => {
    if (p.sport === "football" && p.edge != null &&
        p.edge * 100 >= THRESHOLDS.valueMinPp) {
      keys.add(`football:${norm(`${p.home} v ${p.away}`)}`);
    }
  });
  return keys.size;
}

export type HomeKpis = {
  eventsAnalyzed: number;
  valueOpportunities: number;
  liveEvents: number;
  liveFreshness: { label: string; stale: boolean };
  settledPredictions: number;
  roiPct: number | null;
  modelVersion: string;
  dataDate: string;
  freshness: { level: string; label: string };
  generatedAt: string;
};

export function homeKpis(): HomeKpis {
  const any = SNAPSHOT as any;
  const cum = any.history?.cumulative || {};
  const feed = liveFeed();
  const rows = oracleBoardRows();
  const pulse = loadPulseDoc();

  const modelVersion =
    rows.find((r: any) => r.modelVersion && r.modelVersion !== "—")?.modelVersion ||
    pulse?.model_version ||
    "—";

  return {
    eventsAnalyzed: eventKeys().size,
    valueOpportunities: valueEvents(),
    liveEvents: feed.count,
    liveFreshness: feed.freshness,
    settledPredictions: Number(cum.matches || 0),
    roiPct: typeof cum.roi_pct === "number" ? cum.roi_pct : null,
    modelVersion,
    dataDate: any.dataDate || "",
    freshness: freshness(),
    generatedAt: any.generatedAt || "",
  };
}

/** Classification counts for the value board summary line. */
export function homeValueBreakdown() {
  const counts = { "STRONG VALUE": 0, VALUE: 0, FAIR: 0, PASS: 0 } as Record<string, number>;
  oracleBoardRows().forEach((r: any) => {
    if (typeof r.edge !== "number") return;
    counts[classifyValue(r.edge, "Medium")] += 1;
  });
  return counts;
}
