import type { DataQuality, PredictionStatus, ValueClass } from "@/lib/value";

const VALUE_CLASS: Record<ValueClass, string> = {
  "STRONG VALUE": "badge badge-strong-value",
  VALUE: "badge badge-value",
  FAIR: "badge badge-fair",
  PASS: "badge badge-pass",
};

const STATUS_CLASS: Record<PredictionStatus, string> = {
  UPCOMING: "badge badge-upcoming",
  LIVE: "badge badge-live",
  SETTLED: "badge badge-settled",
  VOID: "badge badge-settled",
  CANCELLED: "badge badge-settled",
  STALE: "badge badge-stale",
};

const QUALITY_CLASS: Record<DataQuality, string> = {
  High: "badge badge-quality-high",
  Medium: "badge badge-quality-med",
  Low: "badge badge-quality-low",
};

export function ValueBadge({ value }: { value: ValueClass }) {
  return <span className={VALUE_CLASS[value]}>{value}</span>;
}

export function StatusBadge({ status, live }: { status: PredictionStatus; live?: boolean }) {
  const s: PredictionStatus = live ? "LIVE" : status;
  return (
    <span className={STATUS_CLASS[s]}>
      {s === "LIVE" && <span className="ds-dot ds-dot-live" />}
      {s}
    </span>
  );
}

export function QualityBadge({ level, reasons }: { level: DataQuality; reasons?: string[] }) {
  return (
    <span className={QUALITY_CLASS[level]} title={reasons?.join(" · ") || undefined}>
      {level} data
    </span>
  );
}

export function FreshnessBadge({ label, stale }: { label: string; stale: boolean }) {
  return <span className={`badge ${stale ? "badge-stale" : "badge-upcoming"}`}>{label}</span>;
}

/** Probability and confidence are different things — this renders both correctly. */
export function ProbConfidence({
  probability,
  confidence,
}: {
  probability: number | null;
  confidence: "High" | "Medium" | "Low" | null;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span className="num" style={{ fontWeight: 700, color: "var(--text)" }}>
        {probability == null ? "—" : `${Math.round(probability * 100)}%`}
      </span>
      {confidence && (
        <span style={{ fontSize: "var(--t-xs)", color: "var(--text-3)" }}>
          · {confidence.toLowerCase()} confidence
        </span>
      )}
    </span>
  );
}
