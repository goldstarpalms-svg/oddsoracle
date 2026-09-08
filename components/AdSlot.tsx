interface AdSlotProps {
  size?: string; // e.g. "Leaderboard (728x90)", "In-article (300x250)"
  label?: string;
  className?: string;
}

/**
 * Ad placeholder.
 *
 * To monetize, replace the <div> content of each slot with your network's
 * ad unit (e.g. Google AdSense code). Keep the wrapping <aside> for
 * accessibility and layout. The `data-ad-slot` attributes are markers.
 */
export default function AdSlot({ size = "Responsive banner", label = "Advertisement", className = "" }: AdSlotProps) {
  return (
    <aside
      aria-label={label}
      className={`ad-slot ad-banner ${className}`}
      style={{ padding: "28px 16px", margin: "26px 0", borderRadius: 12 }}
      data-ad-slot="true"
    >
      <div style={{ fontSize: 11 }}>{label} · {size}</div>
      <div style={{ marginTop: 4, fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.05em" }}>
        AD SPACE
      </div>
    </aside>
  );
}
