"use client";

import { useEffect, useMemo, useState } from "react";
import SNAPSHOT from "@/lib/data-snapshot.json";

interface SlipPick {
  id: string;
  sport: string;
  league: string;
  home: string;
  away: string;
  t: string;
  pick: string; // display pick
  odds: number | null;
  prob: number | null; // % chance of the picked side
  banker: boolean;
}

interface ApiData {
  rich: { football: any[]; basketball: any[]; tennis: any[] };
  summary?: any;
  freshness?: any;
}

function flatten(rich: ApiData["rich"]): SlipPick[] {
  const out: SlipPick[] = [];
  (rich.football || []).forEach((p: any) => {
    if (!p.home || !p.away) return;
    out.push({
      id: p.id,
      sport: "Football",
      league: p.league,
      home: p.home,
      away: p.away,
      t: p.t,
      pick: p.final,
      odds: p.odds,
      prob: p.pickProb,
      banker: !!p.banker,
    });
  });
  (rich.basketball || []).forEach((p: any) => {
    if (!p.home || !p.away) return;
    out.push({
      id: p.id,
      sport: "Basketball",
      league: p.league,
      home: p.home,
      away: p.away,
      t: p.t,
      pick: p.pick || "",
      odds: p.odds,
      prob: p.pickProb,
      banker: !!p.banker,
    });
  });
  (rich.tennis || []).forEach((p: any) => {
    if (!p.p1 || !p.p2) return;
    out.push({
      id: p.id,
      sport: "Tennis",
      league: p.tourn,
      home: p.p1,
      away: p.p2,
      t: p.t,
      pick: p.pred || "",
      odds: p.odds,
      prob: p.pickProb,
      banker: !!p.banker,
    });
  });
  return out;
}

const teamMatch = (needle: string, hay: string): boolean => {
  const n = needle.trim().toLowerCase();
  const h = hay.toLowerCase();
  if (n.length < 3) return false;
  return h.includes(n) || n.includes(h);
};

interface AnalysisRow {
  line: string;
  match: SlipPick | null;
  partial: SlipPick | null;
}

function analyze(text: string, picks: SlipPick[]): AnalysisRow[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3)
    .slice(0, 20)
    .map((line) => {
      let best: SlipPick | null = null;
      let bestScore = 0;
      let partial: SlipPick | null = null;
      for (const p of picks) {
        let score = 0;
        if (teamMatch(line, `${p.home} ${p.league}`) || teamMatch(p.home, line)) score += 1;
        if (teamMatch(line, `${p.away} ${p.league}`) || teamMatch(p.away, line)) score += 1;
        if (score > bestScore) {
          bestScore = score;
          best = p;
        } else if (score === 1 && score > (partial ? 0 : 1)) {
          partial = p;
        }
      }
      if (bestScore >= 2) return { line, match: best, partial: null };
      if (bestScore === 1) return { line, match: null, partial: best };
      return { line, match: null, partial: null };
    });
}

type Tab = "build" | "analyze" | "code" | "odds" | "markets";

interface BookedLeg {
  home: string;
  away: string;
  kickoff_utc: string;
  competition: string;
  market: string;
  specifier: string;
  pick: string;
  odds: number | null;
}

interface BookedSlip {
  ok: boolean;
  error?: string;
  reason?: string | null;
  dailyRemaining?: number | null;
  monthlyRemaining?: number | null;
  selections?: BookedLeg[];
}

const BOOKIES = [
  { id: "sportybet:ng", label: "Sportybet (Nigeria)" },
  { id: "bet9ja", label: "Bet9ja (Nigeria)" },
  { id: "nairabet", label: "Nairabet (Nigeria)" },
  { id: "sportybet:gh", label: "Sportybet (Ghana)" },
  { id: "1xbet:ng", label: "1xbet (Nigeria)" },
];

// ---------- odds compare ----------
interface OddsEvent {
  home: string;
  away: string;
  start: string | null;
  h2h: Record<string, { home: number | null; away: number | null }>;
  totals: Record<string, { line: number | null; over: number | null; under: number | null }>;
}

const BOOK_DISPLAY: Record<string, string> = {
  bet365: "Bet365", pinnacle: "Pinnacle", betfair: "Betfair", bwin: "Bwin",
  betvictor: "BetVictor", betfred: "BetFred", draftkings: "DraftKings",
  fanatics: "Fanatics", caesars: "Caesars", betmgm: "BetMGM",
  williamhill: "William Hill", betway: "Betway", pointsbet: "PointsBet",
  unibet: "Unibet", marathonbet: "Marathon Bet", nairabet: "Nairabet",
  bet9ja: "Bet9ja", sportybet: "Sportybet",
};

const prettyBook = (raw: string): string => {
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(BOOK_DISPLAY)) if (lower.includes(k)) return v;
  return raw.replace(/[_-]/g, " ").replace(/us|uk|eu/gi, "").trim() || raw;
};

function bestBook(
  map: Record<string, { home: number | null; away: number | null }>,
  side: "home" | "away"
): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [book, v] of Object.entries(map)) {
    const p = side === "home" ? v.home : v.away;
    if (typeof p === "number" && p > 1 && (!best || p > best[1])) best = [book, p];
  }
  return best;
}

function bestTotals(
  map: Record<string, { line: number | null; over: number | null; under: number | null }>
): { line: number | null; over: [string, number] | null; under: [string, number] | null } {
  const out = { line: null as number | null, over: null as [string, number] | null, under: null as [string, number] | null };
  for (const [book, v] of Object.entries(map)) {
    if (out.line == null && typeof v.line === "number") out.line = v.line;
    if (typeof v.over === "number" && v.over > 1 && (!out.over || v.over > out.over[1])) out.over = [book, v.over];
    if (typeof v.under === "number" && v.under > 1 && (!out.under || v.under > out.under[1])) out.under = [book, v.under];
  }
  return out;
}

// ---------- all markets (every game, every option, every bookie) ----------
interface MktBook {
  name: string;
  h2h: (number | null)[] | null; // [1, X, 2] or [1, null, 2]
  totals: { line: number | null; over: number | null; under: number | null }[];
  spreads: { point: number | null; home: number | null; away: number | null }[];
  tees: { line: number | null; over: number | null; under: number | null }[];
}

interface MktRow {
  id: string;
  sport: "Football" | "Basketball" | "Tennis" | "MLB" | "American Football";
  t: string;
  home: string;
  away: string;
  lg: string;
  books: MktBook[];
  fbPct: [number, number, number] | null;
  fbPick: string;
  fbScore: string;
  fbDec: (number | null)[] | null;
  model: { pick: string; p: [number, number, number] | null; o25: number | null; bank: string } | null;
}

const mnorm = (s: string) =>
  String(s)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(fc|cf|sc|ac|calcio|club|cd|ud|sd|real|de|fk)\b/g, " ")
    .replace(/[^a-z0-9. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const mmatch = (a: string, b: string) => {
  const x = mnorm(a), y = mnorm(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

function buildMktRows(): MktRow[] {
  const any = SNAPSHOT as any;
  const rows: MktRow[] = [];

  // Football — forebet board as the base, TOA bookmakers merged by team name
  const fb: any[] = Array.isArray(any.football) ? any.football : [];
  const toaSoc: any[] = Array.isArray(any.markets?.soccer) ? any.markets.soccer : [];
  fb.forEach((f, i) => {
    const m = toaSoc.find((t) => mmatch(t.home, f.home) && mmatch(t.away, f.away));
    rows.push({
      id: `soc-${i}`, sport: "Football", t: f.t || "", home: f.home, away: f.away, lg: f.lg || "Football",
      books: m ? m.bookmakers || [] : [],
      fbPct: Array.isArray(f.fb_pct) && f.fb_pct.some((x: number) => x > 0) ? f.fb_pct : null,
      fbPick: f.fb_pick || "", fbScore: f.fb_score || "",
      fbDec: Array.isArray(f.mkt_dec) ? f.mkt_dec : null,
      model: f.model ? { pick: f.model.pick || "", p: f.model.p || null, o25: f.model.o25 ?? null, bank: f.model.bank || "" } : null,
    });
  });

  // Basketball — forebet full board
  const bbAll: any[] = Array.isArray(any.basketball?.forebet_today_all) ? any.basketball.forebet_today_all : [];
  const toaBb: any[] = Array.isArray(any.markets?.basketball) ? any.markets.basketball : [];
  bbAll.forEach((g, i) => {
    const parts = String(g.match || "").split(/\sv\s/i);
    const h = parts[0] || "", a = parts[1] || "";
    const m = toaBb.find((t) => mmatch(t.home, h) && mmatch(t.away, a));
    const prob = String(g.prob || "").split("/");
    rows.push({
      id: `bb-${i}`, sport: "Basketball", t: g.t || "", home: h, away: a, lg: g.league || "Basketball",
      books: m ? m.bookmakers || [] : [],
      fbPct: prob.length === 2 ? [Number(prob[0]), 0, Number(prob[1])] : null,
      fbPick: g.pred === "1" ? "1" : "2", fbScore: g.score || "", fbDec: null, model: null,
    });
  });

  // Tennis — forebet board
  const tn: any[] = Array.isArray(any.tennis?.games) ? any.tennis.games : [];
  const toaTn: any[] = Array.isArray(any.markets?.tennis) ? any.markets.tennis : [];
  tn.forEach((g, i) => {
    const m = toaTn.find((t) => mmatch(t.home, g.p1) && mmatch(t.away, g.p2));
    const prob = String(g.prob || "").split("/");
    rows.push({
      id: `tn-${i}`, sport: "Tennis", t: g.t || "", home: g.p1 || "", away: g.p2 || "", lg: g.tourn || "Tennis",
      books: m ? m.bookmakers || [] : [],
      fbPct: prob.length === 2 ? [Number(prob[0]), 0, Number(prob[1])] : null,
      fbPick: String(g.pred || "").startsWith("1") ? "1" : "2", fbScore: g.sets ? `sets ${g.sets}` : "", fbDec: null, model: null,
    });
  });

  // American football (NCAA) — forebet board + OddsPapi bookmakers when present
  const af: any[] = Array.isArray(any.ncaafb?.games) ? any.ncaafb.games : [];
  const toaAf: any[] = Array.isArray(any.markets?.americanfootball) ? any.markets.americanfootball : [];
  af.forEach((g, i) => {
    const m = toaAf.find((t) => mmatch(t.home, g.home) && mmatch(t.away, g.away));
    const [p1, p2] = String(g.prob || "50/50").split("/").map((x) => Number(x));
    rows.push({
      id: `afoot-${i}`, sport: "American Football", t: g.t || "", home: g.home || "", away: g.away || "",
      lg: g.league || "NCAA",
      books: m ? m.bookmakers || [] : [],
      fbPct: p1 || p2 ? [p1, 0, p2] : null,
      fbPick: String(g.pred || "1") === "1" ? "1" : "2",
      fbScore: g.score || "", fbDec: null, model: null,
    });
  });

  // MLB / NBA — existing multi-bookie feed (odds.json snapshot)
  if (any.odds?.sports) {
    for (const [key, s] of Object.entries<any>(any.odds.sports)) {
      (s.events || []).forEach((e: any, i: number) => {
        const books: MktBook[] = Object.entries<any>(e.h2h || {}).map(([bk, v]) => ({
          name: bk,
          h2h: [v.home ?? null, null, v.away ?? null],
          totals: e.totals?.[bk]
            ? [{ line: e.totals[bk].line, over: e.totals[bk].over, under: e.totals[bk].under }]
            : [],
          spreads: e.spreads?.[bk]
            ? [{ point: e.spreads[bk].point ?? null, home: e.spreads[bk].home ?? null, away: e.spreads[bk].away ?? null }]
            : [],
          tees: [],
        }));
        const st = e.start
          ? new Date(e.start).toLocaleTimeString("en-NG", {
              hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos",
            })
          : "";
        rows.push({
          id: `mlb-${key}-${i}`, sport: "MLB", t: st, home: e.home, away: e.away,
          lg: s.label || key, books, fbPct: null, fbPick: "", fbScore: "", fbDec: null, model: null,
        });
      });
    }
  }

  return rows.sort((a, b) => a.sport.localeCompare(b.sport) || (a.t || "99").localeCompare(b.t || "99"));
}

function mktColBest(books: MktBook[], pick: (b: MktBook) => number | null): number | null {
  let best: number | null = null;
  for (const b of books) {
    const v = pick(b);
    if (typeof v === "number" && v > 1 && (best == null || v > best)) best = v;
  }
  return best;
}

const normPick = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9. ]/g, "").replace(/\s+/g, " ").trim();

function pickSide(pick: string): "1" | "X" | "2" | "O" | "U" | "BT" | "NT" | null {
  const s = normPick(pick);
  if (/btts|both teams (to )?score/.test(s)) return /no\b|not\b/.test(s) ? "NT" : "BT";
  if (/under/.test(s)) return "U";
  if (/over|more than/.test(s)) return "O";
  if (/draw|tie|double chance.*x|\bx\b/.test(s)) return "X";
  if (/away/.test(s)) return "2";
  if (/home/.test(s)) return "1";
  if (/^1$/.test(s)) return "1";
  if (/^2$/.test(s)) return "2";
  if (/^x$/.test(s)) return "X";
  return null;
}

function ourSide(p: SlipPick): "1" | "X" | "2" | "O" | "U" | "BT" | "NT" | null {
  return pickSide(p.pick);
}



export default function SlipTools() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("build");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pastex, setPastex] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisRow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [bookie, setBookie] = useState("sportybet:ng");
  const [code, setCode] = useState("");
  const [decoding, setDecoding] = useState(false);
  const [bookRes, setBookRes] = useState<BookedSlip | null>(null);
  const [openOdds, setOpenOdds] = useState<string | null>(null);
  const [oddsQuery, setOddsQuery] = useState("");

  // generate booking code
  const [genBookie, setGenBookie] = useState("sportybet:ng");
  const [generating, setGenerating] = useState(false);
  const [genRes, setGenRes] = useState<{ ok: boolean; code?: string; error?: string; raw?: string } | null>(null);
  const [genCopied, setGenCopied] = useState(false);

  // all-markets tab state
  const [openMkt, setOpenMkt] = useState<string | null>(null);
  const [mktFilter, setMktFilter] = useState<"all" | "Football" | "Basketball" | "Tennis" | "MLB" | "American Football">("all");
  const [mktQuery, setMktQuery] = useState("");
  const mktRows = useMemo(() => buildMktRows(), []);
  const mktSports = useMemo(
    () =>
      (["Football", "MLB", "American Football", "Basketball", "Tennis"] as const).filter((s) =>
        mktRows.some((r) => r.sport === s)
      ),
    [mktRows]
  );
  const anyBooks = useMemo(() => mktRows.some((r) => r.books.length > 0), [mktRows]);
  const mktVisible = useMemo(() => {
    let rows = mktRows;
    if (mktFilter !== "all") rows = rows.filter((r) => r.sport === mktFilter);
    if (!mktQuery.trim()) return rows;
    const q = mktQuery.toLowerCase();
    return rows.filter(
      (r) => r.home.toLowerCase().includes(q) || r.away.toLowerCase().includes(q) || r.lg.toLowerCase().includes(q)
    );
  }, [mktRows, mktFilter, mktQuery]);

  const oddsData = useMemo(() => (SNAPSHOT as any).odds || null, []);
  const oddsSports = useMemo(() => {
    if (!oddsData || !oddsData.sports) return [];
    return Object.entries(oddsData.sports as Record<string, { label: string; events: OddsEvent[] }>)
      .filter(([, s]) => Array.isArray(s.events) && s.events.length > 0)
      .map(([key, s]) => ({ key, label: s.label, events: s.events }));
  }, [oddsData]);

  const filteredOdds = (events: OddsEvent[]) => {
    if (!oddsQuery.trim()) return events;
    const q = oddsQuery.toLowerCase();
    return events.filter(
      (e) => e.home.toLowerCase().includes(q) || e.away.toLowerCase().includes(q)
    );
  };

  useEffect(() => {
    fetch("/api/predictions/", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const picks = useMemo(() => (data ? flatten(data.rich) : []), [data]);

  const visible = useMemo(() => {
    if (!query.trim()) return picks;
    const q = query.toLowerCase();
    return picks.filter(
      (p) =>
        p.home.toLowerCase().includes(q) ||
        p.away.toLowerCase().includes(q) ||
        p.league.toLowerCase().includes(q)
    );
  }, [picks, query]);

  const slip = useMemo(() => picks.filter((p) => selected.includes(p.id)), [picks, selected]);

  const totalOdds = slip.reduce((acc, l) => acc * (l.odds ?? 1), 1);
  const totalProb = slip.reduce((acc, l) => acc * ((l.prob ?? 0) / 100), 1);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const slipText = () => {
    const date = new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
    const lines = slip.map((l, i) => `${i + 1}. ${l.home} vs ${l.away} — ${l.pick} @${l.odds?.toFixed(2) ?? "—"} (${l.prob ?? "—"}%)`);
    return [
      `ODDSORACLE SLIP — ${date}`,
      ...lines,
      ``,
      `Total odds: @${totalOdds.toFixed(2)}`,
      `Model chance all legs hit: ~${Math.round(totalProb * 100)}%`,
      `Stake: 1 unit max. These are model estimates, not guarantees. 18+`,
    ].join("\n");
  };

  const copySlip = async () => {
    try {
      await navigator.clipboard.writeText(slipText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const shareSlip = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(slipText())}`;
    window.open(url, "_blank");
  };

  const decodeSlip = async () => {
    if (!code.trim() || decoding) return;
    setDecoding(true);
    setBookRes(null);
    try {
      const r = await fetch("/api/slip-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookie, code: code.trim() }),
      });
      const j = await r.json();
      setBookRes(j as BookedSlip);
    } catch {
      setBookRes({ ok: false, error: "Network hiccup talking to our server — try again." });
    } finally {
      setDecoding(false);
    }
  };

  // Map a slip leg's human pick to the booking-code engine's market vocabulary.
  const pickToMarket = (pick: string): { market: string; specifier: string; pick: string } => {
    const s = pick.toLowerCase();
    if (/over\s*(1\.5|2\.5|3\.5|1\.75|2\.25)/.test(s)) {
      const line = s.match(/(1\.5|1\.75|2\.25|2\.5|3\.5)/)?.[1] || "2.5";
      return { market: "over_under", specifier: line, pick: "over" };
    }
    if (/under\s*(1\.5|2\.5|3\.5|1\.75|2\.25)/.test(s)) {
      const line = s.match(/(1\.5|1\.75|2\.25|2.5|3\.5)/)?.[1] || "2.5";
      return { market: "over_under", specifier: line, pick: "under" };
    }
    if (/\b1x\b|home or draw/.test(s)) return { market: "double_chance", specifier: "", pick: "1x" };
    if (/\bx2\b|draw or away/.test(s)) return { market: "double_chance", specifier: "", pick: "x2" };
    if (/no draw|\b12\b/.test(s)) return { market: "double_chance", specifier: "", pick: "12" };
    if (/draw no bet|dnb/.test(s)) {
      const home = /home|\b1\b/.test(s);
      return { market: "draw_no_bet", specifier: "", pick: home ? "home" : "away" };
    }
    if (/both teams to score|btts/.test(s)) {
      return { market: "gg_ng", specifier: "", pick: /no\b|not\b/.test(s) ? "ng" : "gg" };
    }
    if (/\bx\b|draw/.test(s) && !/double/.test(s)) return { market: "1x2", specifier: "", pick: "draw" };
    if (/away|\b2\b/.test(s)) return { market: "1x2", specifier: "", pick: "away" };
    if (/home|\b1\b/.test(s)) return { market: "1x2", specifier: "", pick: "home" };
    return { market: "1x2", specifier: "", pick: "home" };
  };

  // Build a best-effort UTC kickoff from a WAT wall-clock time + the data date.
  const kickoffUtc = (t: string): string => {
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    const date = (SNAPSHOT as any).dataDate || new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Lagos" });
    if (!m) return date;
    let h = Number(m[1]);
    const min = m[2];
    // WAT is UTC+1 → subtract one hour for UTC; roll back a day if it crosses midnight.
    let dayOffset = 0;
    if (h === 0) { dayOffset = -1; h = 24; }
    h -= 1;
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return `${d.toISOString().slice(0, 10)}T${String(h).padStart(2, "0")}:${min}:00Z`;
  };

  const generateCode = async () => {
    if (slip.length === 0 || generating) return;
    setGenerating(true);
    setGenRes(null);
    try {
      const selections = slip.map((l) => {
        const mk = pickToMarket(l.pick);
        return {
          home: l.home,
          away: l.away,
          kickoff_utc: kickoffUtc(l.t),
          competition: l.league,
          market: mk.market,
          specifier: mk.specifier,
          pick: mk.pick,
          ...(typeof l.odds === "number" ? { odds: l.odds } : {}),
        };
      });
      const r = await fetch("/api/book-code/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookie: genBookie, selections }),
      });
      const j = await r.json();
      setGenRes(j);
    } catch {
      setGenRes({ ok: false, error: "Network hiccup talking to our server — try again." });
    } finally {
      setGenerating(false);
    }
  };

  const copyGenCode = async () => {
    if (!genRes?.code) return;
    try {
      await navigator.clipboard.writeText(genRes.code);
      setGenCopied(true);
      setTimeout(() => setGenCopied(false), 2000);
    } catch {}
  };

  const crossCheck = (leg: BookedLeg): SlipPick | null => {
    let best: SlipPick | null = null;
    let bestScore = 0;
    for (const p of picks) {
      let score = 0;
      if (leg.home && teamMatch(leg.home, p.home)) score += 1;
      if (leg.home && teamMatch(p.home, leg.home)) score += 1;
      if (leg.away && teamMatch(leg.away, p.away)) score += 1;
      if (leg.away && teamMatch(p.away, leg.away)) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return bestScore >= 2 ? best : null;
  };

  const kickoffWAT = (iso: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lagos",
    });
  };

  if (error) {
    return (
      <div className="callout callout-blue">
        Couldn&rsquo;t load today&rsquo;s data right now. Refresh the page in a minute.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="hero-card" style={{ maxWidth: 720 }}>
        <div className="mini-row">
          <div className="mini-teams" style={{ color: "var(--text-faint)" }}>Loading today&rsquo;s picks…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="slip-tools">
      {/* TABS */}
      <div className="filter-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "build"} className={`filter-tab ${tab === "build" ? "active" : ""}`} onClick={() => setTab("build")}>
          🧰 Build a slip
        </button>
        <button role="tab" aria-selected={tab === "analyze"} className={`filter-tab ${tab === "analyze" ? "active" : ""}`} onClick={() => setTab("analyze")}>
          🔎 Analyze my slip
        </button>
        <button role="tab" aria-selected={tab === "code"} className={`filter-tab ${tab === "code" ? "active" : ""}`} onClick={() => setTab("code")}>
          🔑 Decode booking code
        </button>
        <button role="tab" aria-selected={tab === "odds"} className={`filter-tab ${tab === "odds" ? "active" : ""}`} onClick={() => setTab("odds")}>
          📊 Odds compare
        </button>
        <button role="tab" aria-selected={tab === "markets"} className={`filter-tab ${tab === "markets" ? "active" : ""}`} onClick={() => setTab("markets")}>
          📚 All markets
        </button>
      </div>

      {tab === "build" ? (
        <div className="slip-layout">
          {/* PICK LIST */}
          <div className="slip-list">
            <input
              className="slip-search"
              type="search"
              placeholder="Search team or league…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search picks"
            />
            <div className="slip-rows">
              {visible.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <label key={p.id} className={`slip-row ${on ? "on" : ""}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                    <span className="slip-row-time">{p.t}</span>
                    <span className="slip-row-match">
                      {p.home} <em>vs</em> {p.away}
                    </span>
                    <span className="slip-row-pick">{p.pick}</span>
                    <span className="slip-row-odds">@{p.odds ? p.odds.toFixed(2) : "—"}</span>
                    {p.banker && <span className="badge badge-banker" style={{ padding: "1px 7px", fontSize: 9.5 }}>🏦</span>}
                  </label>
                );
              })}
              {visible.length === 0 && (
                <div className="callout callout-blue">No matches for that search.</div>
              )}
            </div>
          </div>

          {/* SLIP PANEL */}
          <aside className="slip-panel">
            <h3>Your slip ({slip.length})</h3>
            {slip.length === 0 ? (
              <p className="slip-empty">
                Tick games on the left to build your slip. We&rsquo;ll show the total odds and
                the model&rsquo;s chance of it all hitting.
              </p>
            ) : (
              <>
                <div className="slip-legs">
                  {slip.map((l, i) => (
                    <div className="slip-leg" key={l.id}>
                      <b>{i + 1}.</b> {l.home} vs {l.away} — {l.pick}{" "}
                      <span className="slip-leg-odds">@{l.odds?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="slip-totals">
                  <div>
                    <span>Total odds</span>
                    <b>@{totalOdds.toFixed(2)}</b>
                  </div>
                  <div>
                    <span>Model chance all hit</span>
                    <b className={totalProb >= 0.3 ? "good" : "warn"}>~{Math.round(totalProb * 100)}%</b>
                  </div>
                </div>
                <div className="slip-actions">
                  <button className="btn btn-primary btn-sm" onClick={copySlip}>
                    {copied ? "✓ Copied" : "Copy slip"}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={shareSlip}>
                    WhatsApp →
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>
                    Clear
                  </button>
                </div>

                <div className="slip-gen">
                  <div className="slip-gen-row">
                    <select
                      className="slip-gen-select"
                      value={genBookie}
                      onChange={(e) => setGenBookie(e.target.value)}
                      aria-label="Bookmaker for booking code"
                    >
                      {BOOKIES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={generateCode} disabled={generating}>
                      {generating ? "Generating…" : "🔑 Generate code"}
                    </button>
                  </div>
                  <p className="slip-note">
                    We build a real booking code for this exact slip at the bookie you pick —
                    enter it in their app and the games load by themselves. Uses a small daily
                    free allowance.
                  </p>
                  {genRes && genRes.ok && genRes.code && (
                    <div className="slip-gen-result ok">
                      <div>
                        <span>Your booking code</span>
                        <b className="grad-text" style={{ fontSize: 22, letterSpacing: 1 }}>
                          {genRes.code}
                        </b>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={copyGenCode}>
                        {genCopied ? "✓ Copied" : "Copy code"}
                      </button>
                    </div>
                  )}
                  {genRes && !genRes.ok && (
                    <div className="callout callout-red" style={{ fontSize: 12.5 }}>
                      {genRes.error}
                    </div>
                  )}
                </div>
                <p className="slip-note">
                  “Model chance all hit” multiplies each leg&rsquo;s probability — it drops fast
                  with every extra leg. That&rsquo;s why the rule is: 1 unit max.
                </p>
              </>
            )}
          </aside>
        </div>
      ) : tab === "analyze" ? (
        <div className="slip-analyze">
          <div className="callout">
            <b>How it works:</b> paste your slip below — one leg per line, any format
            (e.g. “Qarabag vs Shafa Baku” or “Zenit Petersburg – Anadolu Efes”). We match each
            line against today&rsquo;s {picks.length} covered games and show you what our model
            thinks of it.
          </div>
          <textarea
            className="slip-input"
            rows={6}
            placeholder={"One leg per line, e.g.\nQarabag vs Shafa Baku\nBayern Munich vs Union Berlin\nDellien"}
            value={pastex}
            onChange={(e) => setPastex(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={() => setAnalysis(analyze(pastex, picks))}
            disabled={pastex.trim().length < 4}
          >
            Analyze my slip →
          </button>

          {analysis && (
            <div className="analysis-list">
              {analysis.map((r, i) => (
                <div key={i} className={`analysis-row ${r.match ? "hit" : r.partial ? "maybe" : "miss"}`}>
                  <div className="analysis-line">{r.line}</div>
                  {r.match ? (
                    <div className="analysis-detail">
                      <b>{r.match.home} vs {r.match.away}</b> · {r.match.league} · {r.match.t} WAT
                      <br />
                      Our pick: <b className="grad-text">{r.match.pick}</b>{" "}
                      <span className="odds-chip">@{r.match.odds?.toFixed(2) ?? "—"}</span>{" "}
                      <span className="score-chip">{r.match.prob ?? "—"}% chance</span>
                      {r.match.banker && <span className="badge badge-banker">🏦</span>}
                    </div>
                  ) : r.partial ? (
                    <div className="analysis-detail dim">
                      Possibly <b>{r.partial.home} vs {r.partial.away}</b> ({r.partial.league}) — check the names.
                    </div>
                  ) : (
                    <div className="analysis-detail dim">
                      Not in today&rsquo;s coverage — we can&rsquo;t vet this leg. Extra caution.
                    </div>
                  )}
                </div>
              ))}
              <p className="slip-note">
                Matching is name-based, so typos can slip through. Treat “not covered” as “we
                have no opinion”, not “it&rsquo;s safe”.
              </p>
            </div>
          )}
        </div>
      ) : tab === "code" ? (
        <div className="slip-analyze">
          <div className="callout callout-blue">
            <b>Booking-code decoder:</b> put in your slip&rsquo;s booking code (the number your
            app shows after you build a bet) and we&rsquo;ll open it, show every leg in plain
            English, and check each one against today&rsquo;s model. Works with Sportybet, Bet9ja
            and Nairabet Nigeria for now.
          </div>
          <div className="code-form">
            <div className="code-field">
              <label htmlFor="code-bookie">Bookie</label>
              <select id="code-bookie" value={bookie} onChange={(e) => setBookie(e.target.value)}>
                {BOOKIES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="code-field">
              <label htmlFor="code-input">Booking code</label>
              <input
                id="code-input"
                className="slip-input"
                type="text"
                placeholder="e.g. 1234567890 or ABC123…"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="code-field code-field-btn">
              <button className="btn btn-primary" onClick={decodeSlip} disabled={code.trim().length < 4 || decoding}>
                {decoding ? "Opening the slip…" : "🔑 Decode my slip"}
              </button>
            </div>
          </div>

          {bookRes && !bookRes.ok && (
            <div className="callout callout-red">
              {bookRes.error}
              {typeof bookRes.dailyRemaining === "number" && (
                <div className="slip-note">Free decodes left today: {bookRes.dailyRemaining}</div>
              )}
            </div>
          )}

          {bookRes && bookRes.ok && bookRes.selections && (
            <div className="analysis-list">
              <div className="callout">
                We opened {bookRes.selections.length} leg{bookRes.selections.length > 1 ? "s" : ""}
                {typeof bookRes.dailyRemaining === "number" && (
                  <> — {bookRes.dailyRemaining} free decode{bookRes.dailyRemaining === 1 ? "" : "s"} left today</>
                )}
                .
              </div>
              {bookRes.selections.map((leg, i) => {
                const ours = crossCheck(leg);
                const theirSide = pickSide(leg.pick);
                const ourSideCode = ours ? ourSide(ours) : null;
                const agrees = ours && theirSide && ourSideCode && theirSide === ourSideCode;
                const conflicts =
                  ours && theirSide && ourSideCode && theirSide !== ourSideCode &&
                  (("1X" as string).includes(theirSide) || ("1X" as string).includes(ourSideCode));
                return (
                  <div key={i} className={`analysis-row ${ours ? "hit" : "miss"}`}>
                    <div className="analysis-line">
                      <b>{i + 1}.</b>{" "}
                      {leg.home && leg.away ? (
                        <>
                          {leg.home} <em>vs</em> {leg.away}
                        </>
                      ) : (
                        leg.competition || "Event"
                      )}{" "}
                      — {leg.market || "market"}
                      {leg.specifier ? ` (${leg.specifier})` : ""}: <b>{leg.pick}</b>
                      {leg.odds ? <span className="odds-chip">@{leg.odds.toFixed(2)}</span> : null}
                    </div>
                    <div className="analysis-detail dim">
                      {leg.kickoff_utc && <>Kick-off: {kickoffWAT(leg.kickoff_utc)} WAT · </>}
                      {leg.competition && leg.home && <>League: {leg.competition} · </>}
                    </div>
                    {ours ? (
                      <div className="analysis-detail">
                        {agrees ? (
                          <>
                            ✅ You backed the same side we do. Our pick: <b className="grad-text">{ours.pick}</b>{" "}
                            <span className="odds-chip">@{ours.odds?.toFixed(2) ?? "—"}</span>{" "}
                            <span className="score-chip">{ours.prob ?? "—"}% chance</span>
                            {ours.banker && <span className="badge badge-banker">🏦</span>}
                          </>
                        ) : conflicts ? (
                          <>
                            ⚠️ We see it differently — we say <b className="grad-text">{ours.pick}</b>{" "}
                            <span className="score-chip">{ours.prob ?? "—"}% chance</span>. Read our pick
                            in today&rsquo;s predictions before sizing up.
                          </>
                        ) : (
                          <>
                            We cover this game, but from another angle. Our pick:{" "}
                            <b className="grad-text">{ours.pick}</b>{" "}
                            <span className="score-chip">{ours.prob ?? "—"}% chance</span>
                            {ours.banker && <span className="badge badge-banker">🏦</span>}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="analysis-detail dim">
                        We don&rsquo;t cover this game today — no model opinion. Extra caution on this leg.
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="slip-note">
                The decoder reads the slip live from the bookie, so odds shown are what&rsquo;s
                currently on offer. If a leg isn&rsquo;t in today&rsquo;s coverage, that means we
                have no opinion on it — not that it&rsquo;s safe.
              </p>
            </div>
          )}
        </div>
      ) : tab === "markets" ? (
        <div className="slip-analyze">
          <div className="callout callout-blue">
            <b>All markets, all bookies:</b> every game on today&rsquo;s board with every
            betting option — match winner (1/X/2), totals (over/under), spreads and tees — at
            every bookmaker&rsquo;s price. <b>💰</b> = best price in that column. Expand any game
            to see the full table.
          </div>
          {!anyBooks && (
            <div className="callout callout-red">
              Bookmaker feed is not connected right now — so this tab shows{" "}
              <b>Forebet&rsquo;s market prices</b> on every game. The moment the odds key is
              switched on, every bookmaker fills in automatically, no extra work.
            </div>
          )}
          <div className="callout" style={{ borderLeft: "3px solid #f59e0b" }}>
            ⚾ <b>Can&rsquo;t find MLB?</b> It&rsquo;s the <b>2nd section, right after Football</b> below
            — or tap the <b>MLB</b> chip above to jump straight to it.
          </div>
          <div className="callout">
            <b>Live bookmaker prices right now:</b> Football — {mktRows.filter((r) => r.sport === "Football" && r.books.length > 0).length} games ·
            Basketball — {mktRows.filter((r) => r.sport === "Basketball" && r.books.length > 0).length} games ·
            MLB — {mktRows.filter((r) => r.sport === "MLB" && r.books.length > 0).length} games, all with
            real bookmaker prices (moneyline, totals, run lines). The rest fill in with each daily drop.
          </div>
          <div className="filter-tabs" role="tablist">
            {(["all", "Football", "MLB", "American Football", "Basketball", "Tennis"] as const)
              .filter((s) => s === "all" || (mktSports as readonly string[]).includes(s))
              .map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={mktFilter === s}
                  className={`filter-tab ${mktFilter === s ? "active" : ""}`}
                  onClick={() => setMktFilter(s)}
                >
                  {s === "all" ? "All sports" : s}
                </button>
              ))}
          </div>
          <input
            className="slip-search"
            type="search"
            placeholder="Search a team or league…"
            value={mktQuery}
            onChange={(e) => setMktQuery(e.target.value)}
            aria-label="Search all markets"
          />
          {(SNAPSHOT as any).markets?.generatedAt && (
            <p className="slip-note">
              Bookmaker odds as of{" "}
              {new Date((SNAPSHOT as any).markets.generatedAt).toLocaleString("en-NG", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
              })}{" "}
              WAT.
            </p>
          )}
          {mktSports.map((sp) => {
            const rows = mktVisible.filter((r) => r.sport === sp);
            if (rows.length === 0) return null;
            const threeWay = sp === "Football";
            return (
              <div key={sp}>
                <div className="league-head">
                  <h3>{sp}</h3>
                  <span className="league-count">{rows.length} games</span>
                </div>
                <div className="odds-list">
                  {rows.map((r) => {
                    const open = openMkt === r.id;
                    const bh = mktColBest(r.books, (b) => (b.h2h ? b.h2h[0] : null));
                    const bx = threeWay ? mktColBest(r.books, (b) => (b.h2h ? b.h2h[1] : null)) : null;
                    const ba = mktColBest(r.books, (b) => (b.h2h ? b.h2h[2] : null));
                    const lineCounts: Record<number, number> = {};
                    for (const b of r.books) for (const t of b.totals) if (typeof t.line === "number") lineCounts[t.line] = (lineCounts[t.line] || 0) + 1;
                    const mainLine = Object.entries(lineCounts)
                      .map(([k, v]) => [Number(k), v] as [number, number])
                      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
                    const tOf = (b: MktBook) => b.totals.find((t) => t.line === mainLine) || b.totals[0] || null;
                    const bt = mktColBest(r.books, (b) => tOf(b)?.over ?? null);
                    const bu = mktColBest(r.books, (b) => tOf(b)?.under ?? null);
                    const hasSpreads = r.books.some((b) => b.spreads.length > 0);
                    const hasTees = r.books.some((b) => b.tees.length > 0);
                    const bsH = hasSpreads ? mktColBest(r.books, (b) => b.spreads[0]?.home ?? null) : null;
                    const bsA = hasSpreads ? mktColBest(r.books, (b) => b.spreads[0]?.away ?? null) : null;
                    return (
                      <div key={r.id} className={`odds-card ${open ? "open" : ""}`}>
                        <button className="odds-card-head" onClick={() => setOpenMkt(open ? null : r.id)} aria-expanded={open}>
                          <span className="odds-card-match">
                            {r.home} <em>vs</em> {r.away}
                          </span>
                          <span className="odds-card-time">
                            {r.t ? `${r.t} WAT` : ""}{r.lg ? ` · ${r.lg}` : ""}
                            {r.books.length > 0 ? ` · ${r.books.length} bookies` : ""}
                          </span>
                          <span className="odds-card-chev">{open ? "▲" : "▼"}</span>
                        </button>
                        {r.books.length > 0 ? (
                          <div className="odds-card-best">
                            <div className="odds-best-col">
                              <span>{threeWay ? "1 (Home)" : r.home}</span>
                              {bh != null ? <b className="odds-hot">💰 @{bh.toFixed(2)}</b> : <b>—</b>}
                            </div>
                            <div className="odds-best-col">
                              <span>{mainLine != null ? `Over/Under ${mainLine}` : "Totals"}</span>
                              {bt != null ? (
                                <>
                                  <b>O {bt.toFixed(2)}</b>
                                  {bu != null && <b> &nbsp;U {bu.toFixed(2)}</b>}
                                </>
                              ) : (
                                <b>—</b>
                              )}
                            </div>
                            {threeWay && (
                              <div className="odds-best-col">
                                <span>X (Draw)</span>
                                {bx != null ? <b className="odds-hot">💰 @{bx.toFixed(2)}</b> : <b>—</b>}
                              </div>
                            )}
                            <div className="odds-best-col">
                              <span>{threeWay ? "2 (Away)" : r.away}</span>
                              {ba != null ? <b className="odds-hot">💰 @{ba.toFixed(2)}</b> : <b>—</b>}
                            </div>
                          </div>
                        ) : null}
                        {open && (
                          <div className="odds-table-wrap">
                            {r.books.length > 0 ? (
                              <>
                                <table className="odds-table">
                                  <thead>
                                    <tr>
                                      <th>Bookie</th>
                                      {threeWay ? (
                                        <>
                                          <th>1</th>
                                          <th>X</th>
                                          <th>2</th>
                                        </>
                                      ) : (
                                        <>
                                          <th>{r.home}</th>
                                          <th>{r.away}</th>
                                        </>
                                      )}
                                      <th>Line</th>
                                      <th>Over</th>
                                      <th>Under</th>
                                      <th>Lines</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.books.map((b) => {
                                      const tl = tOf(b);
                                      const hIs = bh != null && b.h2h && b.h2h[0] === bh;
                                      const xIs = threeWay && bx != null && b.h2h && b.h2h[1] === bx;
                                      const aIs = ba != null && b.h2h && b.h2h[2] === ba;
                                      const oIs = bt != null && tl && tl.over === bt;
                                      const uIs = bu != null && tl && tl.under === bu;
                                      return (
                                        <tr key={b.name}>
                                          <td className="odds-book">{prettyBook(b.name)}</td>
                                          {threeWay ? (
                                            <>
                                              <td className={hIs ? "odds-best-cell" : ""}>{b.h2h && b.h2h[0] ? b.h2h[0].toFixed(2) : "—"}</td>
                                              <td className={xIs ? "odds-best-cell" : ""}>{b.h2h && b.h2h[1] ? b.h2h[1].toFixed(2) : "—"}</td>
                                              <td className={aIs ? "odds-best-cell" : ""}>{b.h2h && b.h2h[2] ? b.h2h[2].toFixed(2) : "—"}</td>
                                            </>
                                          ) : (
                                            <>
                                              <td className={hIs ? "odds-best-cell" : ""}>{b.h2h && b.h2h[0] ? b.h2h[0].toFixed(2) : "—"}</td>
                                              <td className={aIs ? "odds-best-cell" : ""}>{b.h2h && b.h2h[2] ? b.h2h[2].toFixed(2) : "—"}</td>
                                            </>
                                          )}
                                          <td>{tl?.line ?? "—"}</td>
                                          <td className={oIs ? "odds-best-cell" : ""}>{tl?.over ? tl.over.toFixed(2) : "—"}</td>
                                          <td className={uIs ? "odds-best-cell" : ""}>{tl?.under ? tl.under.toFixed(2) : "—"}</td>
                                          <td className="dim">
                                            {Array.from(
                                              new Set(
                                                b.totals.map((t) => t.line).filter((l): l is number => typeof l === "number")
                                              )
                                            )
                                              .sort((a, b) => a - b)
                                              .join(" / ") || "—"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                                {hasSpreads && (
                                  <>
                                    <p className="slip-note"><b>Spread (handicap)</b> — home side carries the point.</p>
                                    <table className="odds-table">
                                      <thead>
                                        <tr>
                                          <th>Bookie</th>
                                          <th>Point</th>
                                          <th>{r.home}</th>
                                          <th>{r.away}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.books.filter((b) => b.spreads.length > 0).map((b) => {
                                          const s = b.spreads[0];
                                          return (
                                            <tr key={b.name}>
                                              <td className="odds-book">{prettyBook(b.name)}</td>
                                              <td>{s.point != null ? s.point : "—"}</td>
                                              <td className={bsH != null && s.home === bsH ? "odds-best-cell" : ""}>{s.home ? s.home.toFixed(2) : "—"}</td>
                                              <td className={bsA != null && s.away === bsA ? "odds-best-cell" : ""}>{s.away ? s.away.toFixed(2) : "—"}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </>
                                )}
                                {hasTees && (
                                  <>
                                    <p className="slip-note"><b>Totals (each bookie&rsquo;s full lines)</b></p>
                                    <table className="odds-table">
                                      <thead>
                                        <tr>
                                          <th>Bookie</th>
                                          <th>Line</th>
                                          <th>Over</th>
                                          <th>Under</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.books
                                          .flatMap((b) => b.tees.map((t) => ({ book: b.name, t })))
                                          .map((row, i) => (
                                            <tr key={i}>
                                              <td className="odds-book">{prettyBook(row.book)}</td>
                                              <td>{row.t.line ?? "—"}</td>
                                              <td>{row.t.over ? row.t.over.toFixed(2) : "—"}</td>
                                              <td>{row.t.under ? row.t.under.toFixed(2) : "—"}</td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <table className="odds-table">
                                  <thead>
                                    <tr>
                                      <th>Market</th>
                                      {threeWay ? (
                                        <>
                                          <th>1 (Home)</th>
                                          <th>X (Draw)</th>
                                          <th>2 (Away)</th>
                                        </>
                                      ) : (
                                        <>
                                          <th>{r.home}</th>
                                          <th>{r.away}</th>
                                        </>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="odds-book">Forebet market</td>
                                      {threeWay ? (
                                        <>
                                          <td>{r.fbDec?.[0] ?? (r.fbPct && r.fbPct[0] > 0 ? (100 / r.fbPct[0]).toFixed(2) : "—")}</td>
                                          <td>{r.fbDec?.[1] ?? (r.fbPct && r.fbPct[1] > 0 ? (100 / r.fbPct[1]).toFixed(2) : "—")}</td>
                                          <td>{r.fbDec?.[2] ?? (r.fbPct && r.fbPct[2] > 0 ? (100 / r.fbPct[2]).toFixed(2) : "—")}</td>
                                        </>
                                      ) : (
                                        <>
                                          <td>{r.fbDec?.[0] ?? "—"}</td>
                                          <td>{r.fbDec?.[2] ?? "—"}</td>
                                        </>
                                      )}
                                    </tr>
                                  </tbody>
                                </table>
                                <p className="slip-note">
                                  Real bookmaker prices for this sport fill in automatically
                                  once the odds feed key is active — 350+ bookmakers on
                                  standby. Forebet&rsquo;s market is shown above in the meantime.
                                </p>
                              </>
                            )}
                            {r.fbPct && (
                              <p className="slip-note dim">
                                Forebet: {r.fbPct[0]}%{threeWay ? ` / ${r.fbPct[1]}% / ${r.fbPct[2]}%` : ` / ${r.fbPct[2]}%`}
                                {r.fbPick ? ` · pick ${r.fbPick}` : ""}
                                {r.fbScore ? ` · ${r.fbScore}` : ""}
                                {r.model && r.model.p ? (
                                  <>
                                    {" "}· Our model: {r.model.p[0]}% / {r.model.p[1]}% / {r.model.p[2]}% →{" "}
                                    <b>{r.model.pick}</b>
                                    {r.model.o25 != null ? ` · O2.5 ${r.model.o25}%` : ""}
                                    {r.model.bank ? ` · ${r.model.bank}` : ""}
                                  </>
                                ) : null}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {mktVisible.length === 0 && <div className="callout callout-blue">No games match that search.</div>}
        </div>
      ) : (
        <div className="slip-analyze">
          <div className="callout callout-blue">
            <b>Odds compare:</b> live prices from several bookmakers on the same game, side by
            side. The <b>💰</b> marks the best price on each side — same game, different bookie,
            a few cents more in your pocket. Prices update with each daily data drop.
          </div>

          {oddsSports.length === 0 && (
            <div className="callout">
              No live odds feed is connected yet. The moment the odds provider key is switched
              on, this tab fills up with bookmaker prices automatically.
            </div>
          )}

          {oddsSports.length > 0 && (
            <>
              <input
                className="slip-search"
                type="search"
                placeholder="Search a team…"
                value={oddsQuery}
                onChange={(e) => setOddsQuery(e.target.value)}
                aria-label="Search odds events"
              />
              {oddsData?.generatedAt && (
                <p className="slip-note">
                  Odds as of {new Date(oddsData.generatedAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })} WAT.
                </p>
              )}
              {oddsSports.map((sport) => (
                <div key={sport.key}>
                  <div className="league-head">
                    <h3>{sport.label}</h3>
                    <span className="league-count">{sport.events.length} games</span>
                  </div>
                  <div className="odds-list">
                    {filteredOdds(sport.events).map((e) => {
                      const key = `${e.home}-${e.away}`;
                      const open = openOdds === key;
                      const bh = bestBook(e.h2h, "home");
                      const ba = bestBook(e.h2h, "away");
                      const bt = bestTotals(e.totals);
                      const start = e.start
                        ? new Date(e.start).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })
                        : "";
                      return (
                        <div key={key} className={`odds-card ${open ? "open" : ""}`}>
                          <button className="odds-card-head" onClick={() => setOpenOdds(open ? null : key)} aria-expanded={open}>
                            <span className="odds-card-match">
                              {e.home} <em>vs</em> {e.away}
                            </span>
                            <span className="odds-card-time">{start} WAT</span>
                            <span className="odds-card-chev">{open ? "▲" : "▼"}</span>
                          </button>
                          <div className="odds-card-best">
                            <div className="odds-best-col">
                              <span>{e.home}</span>
                              {bh ? (
                                <>
                                  <b className="odds-hot">💰 @{bh[1].toFixed(2)}</b>
                                  <small>{prettyBook(bh[0])}</small>
                                </>
                              ) : (
                                <b>—</b>
                              )}
                            </div>
                            <div className="odds-best-col">
                              <span>{bt.line != null ? `Over/Under ${bt.line}` : "Totals"}</span>
                              {bt.over ? (
                                <>
                                  <b>O {bt.over[1].toFixed(2)}</b>
                                  <small>{prettyBook(bt.over[0])}</small>
                                </>
                              ) : (
                                <b>—</b>
                              )}
                            </div>
                            <div className="odds-best-col">
                              <span>{e.away}</span>
                              {ba ? (
                                <>
                                  <b className="odds-hot">💰 @{ba[1].toFixed(2)}</b>
                                  <small>{prettyBook(ba[0])}</small>
                                </>
                              ) : (
                                <b>—</b>
                              )}
                            </div>
                          </div>
                          {open && (
                            <div className="odds-table-wrap">
                              <table className="odds-table">
                                <thead>
                                  <tr>
                                    <th>Bookie</th>
                                    <th>{e.home}</th>
                                    <th>{e.away}</th>
                                    <th>Line</th>
                                    <th>Over</th>
                                    <th>Under</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.keys(e.h2h).map((book) => {
                                    const h = e.h2h[book];
                                    const t = e.totals[book];
                                    const hIsBest = bh && bh[0] === book;
                                    const aIsBest = ba && ba[0] === book;
                                    return (
                                      <tr key={book}>
                                        <td className="odds-book">{prettyBook(book)}</td>
                                        <td className={hIsBest ? "odds-best-cell" : ""}>
                                          {h.home ? h.home.toFixed(2) : "—"}
                                        </td>
                                        <td className={aIsBest ? "odds-best-cell" : ""}>
                                          {h.away ? h.away.toFixed(2) : "—"}
                                        </td>
                                        <td>{t?.line ?? "—"}</td>
                                        <td>{t?.over ? t.over.toFixed(2) : "—"}</td>
                                        <td>{t?.under ? t.under.toFixed(2) : "—"}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredOdds(sport.events).length === 0 && (
                      <div className="callout callout-blue">No games match that search.</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
