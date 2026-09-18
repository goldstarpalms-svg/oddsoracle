"use client";

import { useEffect, useMemo, useState } from "react";

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

type Tab = "build" | "analyze";

export default function SlipTools() {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("build");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pastex, setPastex] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisRow[] | null>(null);
  const [copied, setCopied] = useState(false);

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
      ) : (
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
      )}
    </div>
  );
}
