/**
 * Every data region on the site renders exactly one of these states.
 * No region is allowed to show "Loading…" as permanent content, and none is
 * allowed to substitute placeholder data to look busy.
 */
export type RegionState = "loading" | "ready" | "empty" | "error" | "stale";

export function Skeleton({ lines = 3, height = 14 }: { lines?: number; height?: number }) {
  return (
    <div aria-hidden style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="ds-skeleton"
          style={{ height, width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function StateBlock({
  state,
  emptyTitle = "Nothing to show",
  emptyMessage,
  errorTitle = "Something went wrong",
  errorMessage = "The data provider did not respond. Nothing has been substituted.",
  staleMessage,
  onRetry,
  children,
}: {
  state: RegionState;
  emptyTitle?: string;
  emptyMessage: string;
  errorTitle?: string;
  errorMessage?: string;
  staleMessage?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  if (state === "loading") {
    return (
      <div className="ds-panel" style={{ padding: "var(--s-4)" }}>
        <Skeleton />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="ds-state" role="alert">
        <div className="ds-state-title">{errorTitle}</div>
        <div>{errorMessage}</div>
        {onRetry && (
          <button className="ds-btn ds-btn-sm" style={{ marginTop: 12 }} onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (state === "stale") {
    return (
      <div className="ds-state">
        <div className="ds-state-title">Live data delayed</div>
        <div>{staleMessage || "Showing the last known data — the feed has not updated recently."}</div>
        {onRetry && (
          <button className="ds-btn ds-btn-sm" style={{ marginTop: 12 }} onClick={onRetry}>
            Refresh
          </button>
        )}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="ds-state">
        <div className="ds-state-title">{emptyTitle}</div>
        <div>{emptyMessage}</div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Pick the right state from data — keeps page code honest. */
export function stateFrom<T>({
  loading,
  error,
  data,
  stale,
}: {
  loading: boolean;
  error: boolean;
  data: T[] | null | undefined;
  stale?: boolean;
}): RegionState {
  if (loading) return "loading";
  if (error) return "error";
  if (!data || data.length === 0) return "empty";
  if (stale) return "stale";
  return "ready";
}
