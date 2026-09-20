"use client";

import { useState } from "react";
import type { CardModel } from "@/lib/card";
import { QualityBadge, StatusBadge, ValueBadge } from "@/components/ui/Badge";
import { useSlip } from "@/lib/slip";
import { fmtEv, fmtOdds, fmtPct, fmtPp, THRESHOLDS } from "@/lib/value";

/**
 * The one prediction card. Every board renders this.
 *
 * Order is deliberate: what the model says, what the market says, the gap
 * between them, the price, then the verdict. Advanced material lives behind
 * "Why?" so the card stays readable at a glance.
 */
export default function PredictionCard({ card }: { card: CardModel }) {
  const [open, setOpen] = useState(false);
  const slip = useSlip();
  const inSlip = slip.has(card.id);

  const edgeTone =
    card.edgePp == null
      ? "var(--text-3)"
      : card.edgePp >= THRESHOLDS.valueMinPp
        ? "var(--positive)"
        : card.edgePp < 0
          ? "var(--negative)"
          : "var(--text-2)";

  return (
    <article className="ds-panel" style={{ padding: "var(--s-4)" }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: "var(--s-3)",
        }}
      >
        <span className="ds-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden>{card.sportIcon}</span>
          <span style={{ color: "var(--text-2)" }}>{card.league}</span>
          <span style={{ color: "var(--text-3)" }}>· {card.kickoff || "—"}</span>
        </span>
        <StatusBadge status={card.status} live={card.status === "LIVE"} />
      </div>

      {/* match */}
      <div style={{ marginBottom: "var(--s-3)" }}>
        <div style={{ fontSize: "var(--t-body)", fontWeight: 700, color: "var(--text)" }}>
          {card.home} {card.away && <span style={{ color: "var(--text-3)" }}> v </span>}
          {card.away}
        </div>
        <div className="ds-meta">
          {card.market} · <span style={{ color: "var(--text-2)" }}>{card.selection}</span>
        </div>
      </div>

      {/* metrics */}
      <div className="pulse-metrics" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="pulse-metric">
          <span className="pulse-metric-k">Model</span>
          <span className="pulse-metric-v num">{fmtPct(card.modelProb)}</span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric-k">Market</span>
          <span className="pulse-metric-v num">{fmtPct(card.marketProb)}</span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric-k">Edge</span>
          <span className="pulse-metric-v num" style={{ color: edgeTone }}>{fmtPp(card.edgePp)}</span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric-k">Odds{card.oddsSource === "implied" ? " (implied)" : ""}</span>
          <span
            className="pulse-metric-v num"
            style={card.oddsSource === "implied" ? { color: "var(--text-3)" } : undefined}
          >
            {fmtOdds(card.odds)}
          </span>
        </div>
      </div>

      {/* verdict */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "var(--s-3)" }}>
        {card.priced ? (
          <ValueBadge value={card.value} />
        ) : (
          <span
            className="badge badge-pass"
            title={
              card.oddsSource === "implied"
                ? "Price shown is derived from the model percentage, not quoted by a bookmaker"
                : "No verified book price is published for this market"
            }
          >
            {card.oddsSource === "implied" ? "IMPLIED PRICE" : "NO PRICE"}
          </span>
        )}
        <QualityBadge level={card.quality.level} reasons={card.quality.reasons} />
        {card.banker && <span className="badge badge-fair">🏦 Banker</span>}
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="ds-btn ds-btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Hide" : "Why?"}
        </button>
        <button
          className="ds-btn ds-btn-sm"
          disabled={!card.priced || inSlip}
          onClick={() =>
            slip.add({
              id: card.id,
              event: `${card.home} v ${card.away}`,
              league: card.league,
              market: card.market,
              selection: card.selection,
              odds: card.odds,
              modelProb: card.modelProb,
            })
          }
          title={card.priced ? undefined : "No verified price — cannot be added to a slip"}
        >
          {inSlip ? "In slip" : card.priced ? "Add to Slip" : "No price"}
        </button>
      </div>

      {/* detail */}
      {open && (
        <div style={{ marginTop: "var(--s-4)" }}>
          {card.why && (
            <p className="ds-body" style={{ fontSize: "var(--t-sm)", marginBottom: "var(--s-3)" }}>
              {card.why}
            </p>
          )}

          <div className="ds-section-title">Numbers</div>
          <dl className="ds-kv">
            <dt>Model probability</dt><dd>{fmtPct(card.modelProb)}</dd>
            <dt>Confidence</dt>
            <dd title={card.confidence.note}>{card.confidence.level}</dd>
            <dt>Market probability</dt><dd>{fmtPct(card.marketProb)}</dd>
            <dt>Edge</dt><dd>{fmtPp(card.edgePp)}</dd>
            <dt>Expected value</dt><dd>{card.priced ? fmtEv(card.ev) : "—"}</dd>
          </dl>

          {card.inputs.length > 0 && (
            <>
              <div className="ds-section-title">Inputs used</div>
              <dl className="ds-kv">
                {card.inputs.slice(0, 8).map((i) => (
                  <div key={i.label} style={{ display: "contents" }}>
                    <dt>{i.label}</dt><dd>{i.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {card.evidence.length > 0 && (
            <>
              <div className="ds-section-title">Evidence</div>
              <ul className="ds-evidence">
                {card.evidence.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </>
          )}

          <div className="ds-section-title">Provenance</div>
          <dl className="ds-kv">
            <dt>Engine</dt><dd>{card.engine}</dd>
            <dt>Model version</dt><dd>{card.modelVersion}</dd>
            <dt>Price freshness</dt><dd>{card.freshness.label}</dd>
            <dt>Data quality</dt><dd>{card.quality.score}/100</dd>
          </dl>

          <p className="ds-meta" style={{ marginTop: "var(--s-3)" }}>
            Probability is the estimated chance of this outcome. Confidence is how
            much we trust that estimate. Edge is the gap to the market in
            percentage points. None of these is a guarantee.
          </p>
        </div>
      )}
    </article>
  );
}
