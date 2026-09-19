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

type Tab = "build" | "analyze" | "code" | "odds";

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
