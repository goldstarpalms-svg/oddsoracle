/** A KPI block. The tooltip must state exactly how the number is produced. */
export function Stat({
  label,
  value,
  note,
  help,
  tone,
}: {
  label: string;
  value: string | number;
  note?: string;
  help?: string;
  tone?: "positive" | "warning" | "negative" | "info";
}) {
  const color =
    tone === "positive" ? "var(--positive)"
    : tone === "warning" ? "var(--warning)"
    : tone === "negative" ? "var(--negative)"
    : tone === "info" ? "var(--info)"
    : "var(--text)";
  return (
    <div className="kpi">
      <div className="kpi-label">
        {label}
        {help && (
          <span className="kpi-help" title={help} aria-label={help}>
            ?
          </span>
        )}
      </div>
      <div className="kpi-value num" style={tone ? { color } : undefined}>
        {value}
      </div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

/** Compact system-status strip: MODEL / EVENTS / LIVE DATA / LAST UPDATE. */
export function StatusStrip({
  items,
}: {
  items: { k: string; v: string; dot?: "live" | "ok" | "warn" }[];
}) {
  return (
    <div className="ds-status">
      {items.map((i) => (
        <div className="ds-status-item" key={i.k}>
          <span className="ds-status-k">{i.k}</span>
          <span className="ds-status-v">
            {i.dot && <span className={`ds-dot ds-dot-${i.dot}`} style={{ marginRight: 6 }} />}
            {i.v}
          </span>
        </div>
      ))}
    </div>
  );
}
