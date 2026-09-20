"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate, freshness } from "@/lib/rich";
import type { BoardRow } from "@/lib/rich";
import SNAPSHOT from "@/lib/data-snapshot.json";

const SECTIONS: { key: string; title: string; sub: string; tone: string }[] = [
  { key: "strong", title: "Strong Value", sub: "Model vs price gap with clean data", tone: "strong" },
  { key: "value", title: "Value", sub: "Positive edge — the price underprices the model", tone: "value" },
  { key: "conf", title: "High probability (80%+)", sub: "A big estimated chance — but probability is not value. Some of these are PASS.", tone: "conf" },
  { key: "fair", title: "Fair", sub: "Price and model roughly agree — no play", tone: "fair" },
  { key: "pass", title: "Pass / No Edge", sub: "The engine declined these. Listed for honesty.", tone: "pass" },
];

function sectionOf(r: BoardRow): string {
  if (r.signal === "STRONG VALUE") return "strong";
  if (r.signal === "VALUE") return "value";
  if (r.modelProb >= 80) return "conf";
  if (r.signal === "FAIR") return "fair";
  return "pass";
}

const SORTS = [
  { key: "section", label: "Sections" },
  { key: "oracle", label: "Oracle Score" },
  { key: "edge", label: "Edge" },
  { key: "conf", label: "Confidence" },
  { key: "time", label: "Kick-off" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

export default function OracleBoard({ rows, compact = false }: { rows: BoardRow[]; compact?: boolean }) {
  const [signal, setSignal] = useState("all");
  const [minEdge, setMinEdge] = useState(0);
  const [minConf, setMinConf] = useState(0);
  const [league, setLeague] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("section");
  const [open, setOpen] = useState<string | null>(null);

  const leagues = useMemo(
    () => Array.from(new Set(rows.map((r) => r.league))).sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (signal === "all" || sectionOf(r) === signal) &&
          (sort === "section" ? true : true) &&
          (r.edge ?? -Infinity) >= minEdge * 1 &&
          (minConf === 0 || r.modelProb >= minConf) &&
          (league === "all" || r.league === league) &&
          (!q ||
            r.event.toLowerCase().includes(q.toLowerCase()) ||
            r.league.toLowerCase().includes(q.toLowerCase()))
      ),
    [rows, signal, minEdge, minConf, league, q]
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "oracle") arr.sort((a, b) => b.oracleScore - a.oracleScore);
    else if (sort === "edge") arr.sort((a, b) => (b.edge ?? -Infinity) - (a.edge ?? -Infinity));
    else if (sort === "conf") arr.sort((a, b) => b.modelProb - a.modelProb);
    else if (sort === "time") arr.sort((a, b) => a.time.localeCompare(b.time));
    return arr;
  }, [filtered, sort]);

  const gen = new Date(SNAPSHOT.generatedAt || 0).toLocaleString("en-NG", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
  });

  return (
    <div className={`oracle-board ob-${compact ? "compact" : "full"}`}>
      <div className="ob-head">
        <div className="ob-head-l">
          <h2 className="ob-title">Oracle Model Board</h2>
          <p className="ob-snap">
            {fmtDate(SNAPSHOT.dataDate)} · generated {gen} WAT · model v{rows[0]?.modelVersion.split("-")[0] ?? "—"} ·{" "}
            {rows.length} scored events
          </p>
        </div>
        <div className="ob-snap-right">
          <span className={`fresh-chip fresh-${freshness().level}`}>{freshness().label}</span>
        </div>
      </div>

      <div className="ob-controls">
        <div className="ob-filters">
          <select value={signal} onChange={(e) => setSignal(e.target.value)} aria-label="Filter by section">
            <option value="all">All sections</option>
            {SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.title}</option>
            ))}
          </select>
          <select value={minEdge} onChange={(e) => setMinEdge(Number(e.target.value))} aria-label="Minimum edge">
            <option value={0}>Any edge</option>
            <option value={5}>Edge ≥ 5pp</option>
            <option value={10}>Edge ≥ 10pp</option>
            <option value={15}>Edge ≥ 15pp</option>
          </select>
          <select value={minConf} onChange={(e) => setMinConf(Number(e.target.value))} aria-label="Minimum confidence">
            <option value={0}>Any confidence</option>
            <option value={60}>Model ≥ 60%</option>
            <option value={70}>Model ≥ 70%</option>
            <option value={80}>Model ≥ 80%</option>
          </select>
          <select value={league} onChange={(e) => setLeague(e.target.value)} aria-label="Filter by league">
            <option value="all">All leagues</option>
            {leagues.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>Sort: {s.label}</option>
            ))}
          </select>
        </div>
        <input
          className="ob-search"
          type="search"
          placeholder="Search team or league…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the board"
        />
      </div>

      {sorted.length === 0 && (
        <div className="ob-empty">
          <p><b>No rows match those filters.</b></p>
          <p>Today is a quiet day — or the filters are too tight. The engine lists what it declines, never invents a pick.</p>
        </div>
      )}

      {sort === "section" ? (
        SECTIONS.map((sec) => {
          const secRows = filtered.filter((r) => sectionOf(r) === sec.key);
          if (!secRows.length) return null;
          return (
            <section className={`ob-sec ob-sec-${sec.tone}`} key={sec.key}>
              <div className="ob-sec-head">
                <h3>{sec.title}</h3>
                <span className="ob-sec-count">{secRows.length}</span>
                <span className="ob-sec-sub">{sec.sub}</span>
              </div>
              {secRows.map((r) => (
                <BoardRowView key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
              ))}
            </section>
          );
        })
      ) : (
        <div className="ob-flat">
          {sorted.map((r) => (
            <BoardRowView key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
          ))}
        </div>
      )}

      <p className="ob-footnote">
        Oracle Score is the engine&rsquo;s 0–100 quality rating for a prediction — it is <b>not</b> the chance of winning.
        Confidence is the model probability of the selection. Edge = model % − market-implied %. Nothing here is a guarantee.
      </p>
    </div>
  );
}

function SignalChip({ s, modelProb }: { s: string; modelProb: number }) {
  const tone =
    s === "STRONG VALUE" ? "strong" : s === "VALUE" ? "value" : s === "FAIR" ? "fair" : "pass";
  return (
    <span className="ob-chips">
      <span className={`sig sig-${tone}`}>{s}</span>
      {modelProb >= 80 && <span className="sig sig-conf">HIGH PROBABILITY</span>}
    </span>
  );
}

function BoardRowView({ r, open, onToggle }: { r: BoardRow; open: boolean; onToggle: () => void }) {
  const ep = r.edge;
  const edgeTone = ep == null ? "flat" : ep >= 5 ? "pos" : ep < -2 ? "neg" : "flat";
  return (
    <div className={`ob-row ${open ? "is-open" : ""}`}>
      <button className="ob-row-btn" onClick={onToggle} aria-expanded={open}>
        <div className="ob-cell ob-event">
          <span className="ob-event-name">{r.event}</span>
          <span className="ob-event-meta">{r.league} · {r.time || "TBC"} WAT · {r.market}</span>
        </div>
        <div className="ob-cell ob-sel">
          <span className="ob-sel-pick">{r.selLabel}</span>
          {r.odds > 0 && <span className="ob-sel-odds">@{r.odds.toFixed(2)}</span>}
        </div>
        <div className="ob-cell ob-nums">
          <span className="ob-num"><i>model</i>{r.modelProb}%</span>
          <span className="ob-num"><i>market</i>{r.marketProb == null ? "—" : `${r.marketProb}%`}</span>
          <span className={`ob-num ${edgeTone}`}>{ep == null ? "no price" : `${ep >= 0 ? "+" : ""}${ep}pp`}</span>
          <span className="ob-num ob-score" title="Oracle Score: 0–100 analysis quality. Not win probability.">
            {r.oracleScore}
          </span>
        </div>
        <div className="ob-cell ob-sig">
          <SignalChip s={r.signal} modelProb={r.modelProb} />
        </div>
        <div className="ob-cell ob-chev">{open ? "▴" : "▾"}</div>
      </button>

      {open && (
        <div className="ob-detail">
          <div className="ob-detail-grid">
            <div>
              <h4>Model says</h4>
              <p>
                {r.modelFull.map((p, i) => `${i === 0 ? "1" : i === 1 ? "X" : "2"} ${p}%`).join(" · ")} — selection{" "}
                <b>{r.selLabel}</b> at <b>{r.modelProb}%</b>.
                {r.mcTop.length > 0 && <> Most likely scorelines: {r.mcTop.join(", ")}.</>}
              </p>
            </div>
            <div>
              <h4>Market says</h4>
              <p>
                {r.marketFull.map((p, i) => `${i === 0 ? "1" : i === 1 ? "X" : "2"} ${p}%`).join(" · ")} — the price implies{" "}
                <b>{r.marketProb == null ? "—" : `${r.marketProb}%`}</b> for {r.selLabel}.
                {r.live ? (
                  <> Prices are <b>live</b> (OddsChecker, {r.ts ? new Date(r.ts).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : ""} WAT feed).</>
                ) : (
                  <> No live price at generation — edge uses the latest available market. <b>Not a strong call.</b></>
                )}
              </p>
            </div>
            <div>
              <h4>Edge &amp; EV</h4>
              <p>
                Edge <b>{ep == null ? "—" : `${ep >= 0 ? "+" : ""}${ep}pp`}</b> · EV <b>{r.ev == null ? "—" : `${r.ev >= 0 ? "+" : ""}${r.ev}%`}</b>.{" "}
                {ep != null && ep < 0
                  ? "The price is better than our model — the engine declines it."
                  : "Positive expected value at this price — that is what VALUE means."}
              </p>
            </div>
          </div>

          <div className="ob-why">
            {r.whyPlus.length > 0 && (
              <div>
                <h4>Why the engine took it</h4>
                <ul>{r.whyPlus.map((w, i) => <li key={i} className="plus">{w}</li>)}</ul>
              </div>
            )}
            {r.whyMinus.length > 0 && (
              <div>
                <h4>Why it&rsquo;s downgraded (or why PASS)</h4>
                <ul>{r.whyMinus.map((w, i) => <li key={i} className="minus">{w}</li>)}</ul>
              </div>
            )}
          </div>

          <div className="ob-prov">
            <span>Model v{r.modelVersion}</span>
            <span>Consensus {r.consensus}</span>
            <span>Data quality {r.dataQuality}/100</span>
            <span>Generated {r.ts ? new Date(r.ts).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "—"} WAT</span>
            <Link className="ob-to-slip" href={`/slip/?add=${encodeURIComponent(r.event)}`}>
              Analyze in Slip Lab →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
