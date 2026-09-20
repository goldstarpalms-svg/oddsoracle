import type { PulsePick } from "@/lib/localData";

/**
 * Pulse-Bet enriched board.
 *
 * Forebet supplies the volume; every card here also carries Pulse's own
 * probability, the blended number, the EV against the best available book
 * price, the tier and a fractional-Kelly stake. Nothing is invented: where we
 * have no market price the card says so and no stake is shown.
 */

const TIER_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ELITE: { bg: "linear-gradient(90deg,#f2c200,#ffd84d)", fg: "#1b1400", label: "🌟🌟🌟 ELITE" },
  STRONG: { bg: "linear-gradient(90deg,#1f8f5f,#37d69b)", fg: "#04140d", label: "⭐⭐ STRONG" },
  GOOD: { bg: "linear-gradient(90deg,#2a5fb8,#4f8ff0)", fg: "#f2f7ff", label: "⭐ GOOD" },
  SKIP: { bg: "rgba(148,163,184,.22)", fg: "#c8d3e8", label: "SKIP" },
};

const pct = (v: number | null | undefined) =>
  typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—";

const signed = (v: number | null | undefined) =>
  typeof v === "number" ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%` : "—";

function ProbBar({ label, p }: { label: string; p: number[] | null }) {
  if (!p || p.length !== 3) return null;
  return (
    <div className="pulse-prob">
      <span className="pulse-prob-label">{label}</span>
      <span className="pulse-prob-nums">
        {Math.round(p[0] * 100)} / {Math.round(p[1] * 100)} / {Math.round(p[2] * 100)}
      </span>
    </div>
  );
}

export function PulseCard({ p }: { p: PulsePick }) {
  const tier = TIER_STYLE[p.tier] || TIER_STYLE.SKIP;
  const priced = typeof p.price === "number" && p.price > 1;
  const stake = (p.stake_units ?? 0) > 0;

  return (
    <article className="pred-card">
      <div className="pred-top">
        <span
          className="pulse-tier"
          style={{ background: tier.bg, color: tier.fg }}
          title="Pulse-Bet tier: probability + EV thresholds"
        >
          {tier.label}
        </span>
        <span className="kickoff">{p.kickoff_label || p.kickoff}</span>
      </div>

      <div className="pred-teams">
        <span className="pred-team">{p.home}</span>
        <span className="pred-vs">vs</span>
        <span className="pred-team">{p.away}</span>
      </div>

      <div className="pred-body">
        <div className="pred-market">
          {p.league} · {p.market}
        </div>
        <div className="pred-tip-row">
          <span className="pred-tip grad-text">{p.selection}</span>
          <span className="pred-odds">{priced ? `@${p.price?.toFixed(2)}` : "no price"}</span>
        </div>
      </div>

      <div className="pulse-metrics">
        <div className="pulse-metric">
          <span className="pulse-metric-k">Blend</span>
          <span className="pulse-metric-v">{pct(p.model_prob)}</span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric-k">EV</span>
          <span
            className="pulse-metric-v"
            style={{
              color:
                p.edge == null ? "inherit" : p.edge >= 0.03 ? "#37d69b" : p.edge > 0 ? "#8fd6b4" : "#ff8080",
            }}
          >
            {priced ? signed(p.edge) : "—"}
          </span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric-k">Stake</span>
          <span className="pulse-metric-v">
            {stake ? `${p.stake_units}u · ₦${p.stake_ngn.toLocaleString()}` : "0u"}
          </span>
        </div>
        <div className="pulse-metric">
          <span className="pulse-metric-k">Best book</span>
          <span className="pulse-metric-v">{p.book || "—"}</span>
        </div>
      </div>

      <div className="pulse-probs">
        <ProbBar label="Pulse" p={p.p_pulse} />
        <ProbBar label="Market" p={p.p_market} />
        <ProbBar label="Forebet" p={p.p_forebet} />
      </div>

      <p className="analysis">{p.reasoning}</p>

      <div className="pred-foot">
        <span className="conf conf-value">
          {priced ? `best of ${(p.price_source || "").replace(/[^0-9]/g, "") || "board"} prices` : "no market price published"}
        </span>
        {p.ev_flag && <span className="banker-badge">📈 +EV</span>}
        {!p.model_ok && <span className="conf conf-balanced">model n/a for this fixture</span>}
      </div>
    </article>
  );
}

export default function PulseBoard({
  picks,
  limit,
  empty = "Pulse-Bet has not exported today's enrichment yet.",
}: {
  picks: PulsePick[];
  limit?: number;
  empty?: string;
}) {
  if (!picks.length) {
    return (
      <div className="callout" style={{ marginTop: 12 }}>
        {empty}
      </div>
    );
  }
  const shown = limit ? picks.slice(0, limit) : picks;
  return (
    <div className="pred-grid">
      {shown.map((p) => (
        <PulseCard key={p.id} p={p} />
      ))}
    </div>
  );
}
