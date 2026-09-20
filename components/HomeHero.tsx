import Link from "next/link";
import { Stat, StatusStrip } from "@/components/ui/Stat";
import { homeKpis } from "@/lib/home";
import { THRESHOLDS } from "@/lib/value";

function relative(iso: string): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function HomeHero() {
  const k = homeKpis();

  return (
    <section className="hero hero-4">
      <div className="container">
        <div style={{ display: "grid", gap: "var(--s-6)" }}>
          <div style={{ maxWidth: 760 }}>
            <p className="ds-eyebrow" style={{ marginBottom: "var(--s-3)" }}>
              Sports Intelligence Terminal
            </p>
            <h1 className="ds-display" style={{ marginBottom: "var(--s-4)" }}>
              ODDSORACLE
            </h1>
            <p className="ds-body" style={{ fontSize: "1.0625rem", color: "var(--text-2)" }}>
              Turn live odds and sports data into transparent model probabilities, market
              edges and evidence. Every number on this site can be traced back to the
              model, the market price and the data behind it.
            </p>
            <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap", marginTop: "var(--s-5)" }}>
              <Link href="/board/" className="ds-btn ds-btn-primary ds-btn-lg">
                Explore today&rsquo;s board
              </Link>
              <Link href="/slip/" className="ds-btn ds-btn-lg">
                Analyze a slip
              </Link>
            </div>
          </div>

          <StatusStrip
            items={[
              { k: "Model", v: k.modelVersion, dot: "ok" },
              { k: "Events", v: String(k.eventsAnalyzed) },
              {
                k: "Live data",
                v: k.liveFreshness.stale ? "delayed" : "live",
                dot: k.liveFreshness.stale ? "warn" : "live",
              },
              { k: "Last update", v: relative(k.generatedAt) },
            ]}
          />

          <div className="kpi-grid">
            <Stat
              label="Events analyzed"
              value={k.eventsAnalyzed}
              note={`Data window: ${k.dataDate || "current"}`}
              help="Unique sporting events processed during the current data window. One match = one event, no matter how many markets or engines cover it."
            />
            <Stat
              label="Value opportunities"
              value={k.valueOpportunities}
              tone={k.valueOpportunities > 0 ? "positive" : undefined}
              note={`Model ≥${THRESHOLDS.valueMinPp}pp above market`}
              help={`Events where our model probability exceeds the de-vigged market probability by ${THRESHOLDS.valueMinPp} percentage points or more. This is a measured disagreement with the market, not a prediction of a result.`}
            />
            <Stat
              label="Live-priced events"
              value={k.liveEvents}
              tone={k.liveFreshness.stale ? "warning" : undefined}
              note={k.liveFreshness.label}
              help="Events with a live bookmaker price feed attached. This counts priced events, not matches currently in play."
            />
            <Stat
              label="Settled predictions"
              value={k.settledPredictions}
              tone={k.roiPct == null ? undefined : k.roiPct >= 0 ? "positive" : "negative"}
              note={k.roiPct == null ? "awaiting settlement" : `ROI ${k.roiPct.toFixed(1)}%`}
              help="Published predictions that have finished and been scored against the real result. Losses are included and are never removed."
            />
          </div>
        </div>
      </div>
    </section>
  );
}
