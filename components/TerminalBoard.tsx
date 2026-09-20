"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BoardEvent } from "@/lib/board";
import { explain } from "@/lib/explain";
import {
  QualityBadge,
  StatusBadge,
  ValueBadge,
  FreshnessBadge,
} from "@/components/ui/Badge";
import { StateBlock } from "@/components/ui/StateBlock";
import { useSlip } from "@/lib/slip";
import { fmtEv, fmtOdds, fmtPct, fmtPp, THRESHOLDS } from "@/lib/value";

type SortKey = "kickoff" | "edge" | "model" | "odds" | "ev" | "quality";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "edge", label: "Edge" },
  { key: "kickoff", label: "Kickoff" },
  { key: "model", label: "Model probability" },
  { key: "odds", label: "Odds" },
  { key: "ev", label: "Expected value" },
  { key: "quality", label: "Data quality" },
];

const VALUE_CLASSES = ["STRONG VALUE", "VALUE", "FAIR", "PASS"] as const;

/** Every filter composes — none of them replaces another. */
type Filters = {
  league: string;
  value: string;
  minEdge: number;
  minProb: number;
  oddsLow: number;
  oddsHigh: number;
  quality: string;
  engine: string;
  q: string;
};

const EMPTY: Filters = {
  league: "all",
  value: "all",
  minEdge: 0,
  minProb: 0,
  oddsLow: 0,
  oddsHigh: 0,
  quality: "all",
  engine: "all",
  q: "",
};

export default function TerminalBoard({ events }: { events: BoardEvent[] }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortKey>("edge");
  const [desc, setDesc] = useState(true);
  const [open, setOpen] = useState<BoardEvent | null>(null);
  const slip = useSlip();

  const leagues = useMemo(
    () => Array.from(new Set(events.map((e) => e.league))).sort(),
    [events]
  );

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return events.filter((e) => {
      if (f.league !== "all" && e.league !== f.league) return false;
      if (f.value !== "all" && e.valueClass !== f.value) return false;
      if (f.minEdge && (e.edgePp == null || e.edgePp < f.minEdge)) return false;
      if (f.minProb && (e.modelProb == null || e.modelProb * 100 < f.minProb)) return false;
      if (f.oddsLow && (e.odds == null || e.odds < f.oddsLow)) return false;
      if (f.oddsHigh && (e.odds == null || e.odds > f.oddsHigh)) return false;
      if (f.quality !== "all" && e.quality.level !== f.quality) return false;
      if (f.engine !== "all" && !e.engines.some((g) => g.label === f.engine)) return false;
      if (q && !`${e.home} ${e.away} ${e.league}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, f]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = desc ? -1 : 1;
    const num = (v: number | null) => (v == null ? -Infinity : v);
    arr.sort((a, b) => {
      switch (sort) {
        case "edge": return (num(a.edgePp) - num(b.edgePp)) * dir;
        case "model": return (num(a.modelProb) - num(b.modelProb)) * dir;
        case "odds": return (num(a.odds) - num(b.odds)) * dir;
        case "ev": return (num(a.ev) - num(b.ev)) * dir;
        case "quality": return (a.quality.score - b.quality.score) * dir;
        default: return a.kickoff.localeCompare(b.kickoff) * (desc ? -1 : 1);
      }
    });
    return arr;
  }, [filtered, sort, desc]);

  const activeChips: { label: string; clear: () => void }[] = [];
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));
  if (f.league !== "all")
    activeChips.push({ label: `League: ${f.league}`, clear: () => set("league", "all") });
  if (f.value !== "all")
    activeChips.push({ label: `Value: ${f.value}`, clear: () => set("value", "all") });
  if (f.minEdge)
    activeChips.push({ label: `Edge ≥ ${f.minEdge}pp`, clear: () => set("minEdge", 0) });
  if (f.minProb)
    activeChips.push({ label: `Model ≥ ${f.minProb}%`, clear: () => set("minProb", 0) });
  if (f.oddsLow || f.oddsHigh)
    activeChips.push({
      label: `Odds ${f.oddsLow || "—"}–${f.oddsHigh || "—"}`,
      clear: () => { set("oddsLow", 0); set("oddsHigh", 0); },
    });
  if (f.quality !== "all")
    activeChips.push({ label: `Quality: ${f.quality}`, clear: () => set("quality", "all") });
  if (f.engine !== "all")
    activeChips.push({ label: `Engine: ${f.engine}`, clear: () => set("engine", "all") });
  if (f.q)
    activeChips.push({ label: `Search: ${f.q}`, clear: () => set("q", "") });

  return (
    <div>
      {/* ---------------- filters ---------------- */}
      <div className="ds-filters">
        <div className="ds-field">
          <span>Search</span>
          <input
            className="ds-input"
            placeholder="Team or league"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <div className="ds-field">
          <span>League</span>
          <select className="ds-select" value={f.league} onChange={(e) => set("league", e.target.value)}>
            <option value="all">All</option>
            {leagues.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="ds-field">
          <span>Value class</span>
          <select className="ds-select" value={f.value} onChange={(e) => set("value", e.target.value)}>
            <option value="all">All</option>
            {VALUE_CLASSES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="ds-field">
          <span>Min edge</span>
          <select className="ds-select" value={f.minEdge} onChange={(e) => set("minEdge", Number(e.target.value))}>
            <option value={0}>Any</option>
            {[2, 5, 10, 15].map((v) => <option key={v} value={v}>≥ {v}pp</option>)}
          </select>
        </div>
        <div className="ds-field">
          <span>Min model %</span>
          <select className="ds-select" value={f.minProb} onChange={(e) => set("minProb", Number(e.target.value))}>
            <option value={0}>Any</option>
            {[50, 60, 70, 80].map((v) => <option key={v} value={v}>≥ {v}%</option>)}
          </select>
        </div>
        <div className="ds-field">
          <span>Odds from</span>
          <input
            className="ds-input num"
            type="number" step="0.05" min="1" placeholder="1.50"
            value={f.oddsLow || ""}
            onChange={(e) => set("oddsLow", Number(e.target.value) || 0)}
          />
        </div>
        <div className="ds-field">
          <span>Odds to</span>
          <input
            className="ds-input num"
            type="number" step="0.05" min="1" placeholder="4.00"
            value={f.oddsHigh || ""}
            onChange={(e) => set("oddsHigh", Number(e.target.value) || 0)}
          />
        </div>
        <div className="ds-field">
          <span>Data quality</span>
          <select className="ds-select" value={f.quality} onChange={(e) => set("quality", e.target.value)}>
            <option value="all">All</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div className="ds-field">
          <span>Engine</span>
          <select className="ds-select" value={f.engine} onChange={(e) => set("engine", e.target.value)}>
            <option value="all">All</option>
            <option value="Oracle">Oracle</option>
            <option value="Pulse-Bet">Pulse-Bet</option>
          </select>
        </div>
        <div className="ds-field">
          <span>Sort</span>
          <select className="ds-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <button className="ds-btn ds-btn-sm" onClick={() => setDesc((d) => !d)}>
          {desc ? "Desc ↓" : "Asc ↑"}
        </button>
      </div>

      {activeChips.length > 0 && (
        <div className="ds-chips">
          {activeChips.map((c) => (
            <span className="ds-chip" key={c.label}>
              {c.label}
              <button onClick={c.clear} aria-label={`Clear ${c.label}`}>✕</button>
            </span>
          ))}
          <button className="ds-chip" onClick={() => setF(EMPTY)}>Clear all</button>
        </div>
      )}

      <div className="ds-meta" style={{ marginBottom: "var(--s-2)" }}>
        {sorted.length} of {events.length} events
        {slip.legs.length > 0 && (
          <>
            {" · "}
            <Link href="/slip/" style={{ color: "var(--accent)" }}>
              {slip.legs.length} selection{slip.legs.length === 1 ? "" : "s"} in your slip
            </Link>
          </>
        )}
      </div>

      {/* ---------------- board ---------------- */}
      <StateBlock
        state={sorted.length === 0 ? "empty" : "ready"}
        emptyMessage="No event matches these filters. Loosen one of them — we will not pad the board with unrelated fixtures."
      >
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>League</th>
                <th>Market</th>
                <th>Selection</th>
                <th className="right">Model</th>
                <th className="right">Market</th>
                <th className="right">Edge</th>
                <th className="right">Odds</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setOpen(e)}
                  style={{ cursor: "pointer" }}
                  title="Open the full prediction detail"
                >
                  <td className="num">{e.kickoff || "—"}</td>
                  <td style={{ color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {e.home} <span style={{ color: "var(--text-3)" }}>v</span> {e.away}
                  </td>
                  <td>{e.league}</td>
                  <td>{e.market}</td>
                  <td style={{ color: "var(--text)" }}>{e.marketLabel}</td>
                  <td className="right num">{fmtPct(e.modelProb)}</td>
                  <td className="right num">{fmtPct(e.marketProb)}</td>
                  <td
                    className="right num"
                    style={{
                      color:
                        e.edgePp == null ? "var(--text-3)"
                        : e.edgePp >= THRESHOLDS.valueMinPp ? "var(--positive)"
                        : e.edgePp < 0 ? "var(--negative)" : "var(--text-2)",
                      fontWeight: 650,
                    }}
                  >
                    {fmtPp(e.edgePp)}
                  </td>
                  <td className="right num">{fmtOdds(e.odds)}</td>
                  <td><ValueBadge value={e.valueClass} /></td>
                  <td><StatusBadge status={e.status} live={e.status === "LIVE"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* mobile: compact expandable cards */}
        <div className="ds-mobile-list">
          {sorted.map((e) => (
            <div className="ds-mobile-card" key={e.id}>
              <button
                className="ds-mobile-head"
                onClick={() => setOpen(e)}
                style={{ background: "none", border: 0, width: "100%", textAlign: "left", color: "inherit" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="ds-meta">
                    {e.kickoff} · {e.league} · {e.market}
                  </div>
                  <div style={{ color: "var(--text)", fontWeight: 650 }}>
                    {e.home} <span style={{ color: "var(--text-3)" }}>v</span> {e.away}
                  </div>
                  <div className="ds-meta" style={{ marginTop: 2 }}>
                    {e.marketLabel} · model {fmtPct(e.modelProb)} · market {fmtPct(e.marketProb)}
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "grid", gap: 4 }}>
                  <span className="num" style={{ fontWeight: 700 }}>{fmtOdds(e.odds)}</span>
                  <span
                    className="num"
                    style={{
                      fontSize: "var(--t-sm)",
                      color: e.edgePp == null ? "var(--text-3)"
                        : e.edgePp >= THRESHOLDS.valueMinPp ? "var(--positive)" : "var(--text-2)",
                    }}
                  >
                    {fmtPp(e.edgePp)}
                  </span>
                  <ValueBadge value={e.valueClass} />
                </div>
              </button>
            </div>
          ))}
        </div>
      </StateBlock>

      {/* ---------------- detail panel ---------------- */}
      {open && <DetailPanel event={open} onClose={() => setOpen(null)} onAdd={slip.add} inSlip={slip.has(open.id)} />}
    </div>
  );
}

function DetailPanel({
  event: e,
  onClose,
  onAdd,
  inSlip,
}: {
  event: BoardEvent;
  onClose: () => void;
  onAdd: (leg: Omit<import("@/lib/slip").SlipLeg, "createdAt">) => void;
  inSlip: boolean;
}) {
  const explanation = explain(e);
  return (
    <div className="ds-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ds-panel-slide" onClick={(ev) => ev.stopPropagation()}>
        <div className="ds-panel-head">
          <div>
            <p className="ds-eyebrow">{e.league} · {e.market}</p>
            <h2 className="ds-h2" style={{ marginTop: 6 }}>
              {e.home} <span style={{ color: "var(--text-3)" }}>v</span> {e.away}
            </h2>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <StatusBadge status={e.status} live={e.status === "LIVE"} />
              <ValueBadge value={e.valueClass} />
              <QualityBadge level={e.quality.level} reasons={e.quality.reasons} />
              <FreshnessBadge label={e.freshness.label} stale={e.freshness.stale} />
            </div>
          </div>
          <button className="ds-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ds-section-title">Prediction</div>
        <dl className="ds-kv">
          <dt>Selection</dt><dd>{e.marketLabel}</dd>
          <dt>Model probability</dt><dd>{fmtPct(e.modelProb)}</dd>
          <dt>Confidence</dt>
          <dd title={e.confidence.note}>{e.confidence.level}</dd>
          <dt>Market implied (raw)</dt><dd>{fmtPct(e.rawImplied)}</dd>
          <dt>Market (de-vigged)</dt><dd>{fmtPct(e.marketProb)}</dd>
          <dt>Edge</dt><dd>{fmtPp(e.edgePp)}</dd>
          <dt>Decimal odds</dt><dd>{fmtOdds(e.odds)}</dd>
          <dt>Expected value</dt><dd>{fmtEv(e.ev)}</dd>
          <dt>Model version</dt><dd>{e.modelVersion}</dd>
        </dl>

        {e.engines.length > 1 && (
          <>
            <div className="ds-section-title">Engine cross-check</div>
            <dl className="ds-kv">
              {e.engines.map((g) => (
                <div key={g.label} style={{ display: "contents" }}>
                  <dt>{g.label} ({g.version})</dt>
                  <dd>{fmtPct(g.prob)}</dd>
                </div>
              ))}
            </dl>
            <p className="ds-meta" style={{ marginTop: 8 }}>
              Two engines cover this event. They are shown side by side rather than
              silently averaged — where they disagree, treat the estimate as less stable.
            </p>
          </>
        )}

        <div className="ds-section-title">Why does the model like this?</div>
        <p className="ds-body" style={{ fontSize: "var(--t-sm)" }}>{explanation}</p>

        {e.evidence.length > 0 && (
          <>
            <div className="ds-section-title">Evidence</div>
            <ul className="ds-evidence">
              {e.evidence.slice(0, 6).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </>
        )}

        {e.inputs.length > 0 && (
          <>
            <div className="ds-section-title">Model inputs used</div>
            <dl className="ds-kv">
              {e.inputs.map((i) => (
                <div key={i.label} style={{ display: "contents" }}>
                  <dt>{i.label}</dt><dd>{i.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        <div className="ds-section-title">Data quality — {e.quality.level} ({e.quality.score}/100)</div>
        <ul className="ds-evidence">
          {e.quality.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>

        <div style={{ display: "flex", gap: 8, marginTop: "var(--s-5)" }}>
          <button
            className="ds-btn ds-btn-primary"
            disabled={inSlip || !e.odds}
            onClick={() =>
              onAdd({
                id: e.id,
                event: `${e.home} v ${e.away}`,
                league: e.league,
                market: e.market,
                selection: e.marketLabel,
                odds: e.odds,
                modelProb: e.modelProb,
              })
            }
          >
            {inSlip ? "In your slip" : e.odds ? "Add to Slip" : "No price — cannot add"}
          </button>
          <Link href="/methodology/" className="ds-btn">How this is calculated</Link>
        </div>

        <p className="ds-meta" style={{ marginTop: "var(--s-4)" }}>
          Probability is the estimated chance of this outcome. Confidence describes how
          much we trust that estimate. Edge is the gap to the market in percentage
          points. None of these guarantee a result.
        </p>
      </div>
    </div>
  );
}
