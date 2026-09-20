import { oddsFreshness } from "@/lib/value";

/**
 * Honest board status. If the snapshot is old, say so at the top of the board
 * rather than letting stale picks masquerade as today's.
 */
export default function BoardStatus({ generatedAt }: { generatedAt: string }) {
  const f = oddsFreshness(generatedAt || null);
  if (!f.stale) return null;
  return (
    <div
      className="ds-state"
      style={{ textAlign: "left", borderStyle: "solid", marginBottom: "var(--s-3)" }}
      role="status"
    >
      <div className="ds-state-title">Board is running on the last data drop</div>
      <div>
        {f.label}. Prices shown may have moved since. New fixtures and prices publish after the
        morning update — nothing on this page is presented as newer than it is.
      </div>
    </div>
  );
}
