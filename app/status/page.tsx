import type { Metadata } from "next";
import SNAPSHOT from "@/lib/data-snapshot.json";
import { freshness, summary } from "@/lib/rich";

/**
 * /status — founder control center.
 * Private by convention: noindex, not linked from nav or footer.
 * Shows pipeline health, feed freshness, model version and data counts.
 */
export const metadata: Metadata = {
  title: "Status",
  robots: { index: false, follow: false },
};

function FeedRow({ name, state, note }: { name: string; state: "ok" | "warn" | "off"; note: string }) {
  const cls = state === "ok" ? "st-ok" : state === "warn" ? "st-warn" : "st-off";
  return (
    <tr>
      <td>{name}</td>
      <td><span className={`status-pill ${cls}`}>{state === "ok" ? "● ok" : state === "warn" ? "● degraded" : "○ off"}</span></td>
      <td className="status-note">{note}</td>
    </tr>
  );
}

export default function StatusPage() {
  const s = SNAPSHOT as any;
  const sum = summary();
  const gen = new Date(s.generatedAt || 0).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
  const fb = s.football || [];
  const livePrices = fb.filter((r: any) => r.oracle?.prices_live).length;
  const stale = fb.filter((r: any) => r.oracle && !r.oracle.prices_live).length;
  const modelVersion = fb[0]?.oracle?.model_version || "—";
  const dataTs = fb[0]?.oracle?.data_timestamp || "—";
  const skGames = (s.setka?.games || []).length;
  const hist = s.history;
  const settled = hist?.cumulative?.matches ?? 0;
  const roi = hist?.cumulative?.roi_pct ?? null;

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ fontSize: 11, fontFamily: "var(--mono)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-faint)" }}>
        ODDSORACLE · FOUNDER CONTROL CENTER · NOINDEX
      </div>
      <h1 style={{ fontSize: 26, margin: "8px 0 4px" }}>System status</h1>
      <p style={{ color: "var(--text-dim)", fontSize: 14, margin: "0 0 20px" }}>
        Canonical snapshot <b>{s.dataDate}</b> · generated <b>{gen} WAT</b> ·{" "}
        <span className={`fresh-chip fresh-${freshness().level}`}>{freshness().label}</span>
      </p>

      <div className="hero-card" style={{ padding: 18, marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Data feeds</h3>
        <table className="mkt-table">
          <thead>
            <tr><th>Feed</th><th>State</th><th>Note</th></tr>
          </thead>
          <tbody>
            <FeedRow name="Forebet (boards)" state="ok" note={`${sum.football} football · ${sum.basketball} basketball · ${sum.tennis} tennis games today`} />
            <FeedRow
              name="OddsChecker (live prices)"
              state={livePrices >= 20 ? "ok" : livePrices > 0 ? "warn" : "off"}
              note={`${livePrices}/${sum.football} football rows live-priced${stale ? ` · ${stale} on previous-day prices (no strong calls on those)` : ""}`}
            />
            <FeedRow
              name="Setka Cup (table tennis)"
              state={skGames > 0 ? "ok" : "off"}
              note={`${skGames} games · ${(s.setka?.history?.matches ?? 0).toLocaleString()} matches of history`}
            />
            <FeedRow
              name="ESPN (US scores)"
              state="ok"
              note="settlement runs nightly — NFL board lands from 25 Sep"
            />
            <FeedRow
              name="Track record (settlements)"
              state="ok"
              note={`${settled} settled · ROI ${roi != null ? `${roi >= 0 ? "+" : ""}${roi}%` : "—"} · losses preserved`}
            />
          </tbody>
        </table>
      </div>

      <div className="hero-card" style={{ padding: 18, marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>Model &amp; provenance</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, fontSize: 13 }}>
          <div><span style={{ color: "var(--text-faint)" }}>engine</span><br /><b style={{ fontFamily: "var(--mono)" }}>{modelVersion}</b></div>
          <div><span style={{ color: "var(--text-faint)" }}>data timestamp (first row)</span><br /><b style={{ fontFamily: "var(--mono)" }}>{new Date(dataTs).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })} WAT</b></div>
          <div><span style={{ color: "var(--text-faint)" }}>snapshot age</span><br /><b>{freshness().label}</b></div>
          <div><span style={{ color: "var(--text-faint)" }}>sections</span><br /><b style={{ fontFamily: "var(--mono)" }}>
            fb {(s.football || []).length} · bb {(s.basketball?.games || []).length} · tn {(s.tennis?.games || []).length} · hk {(s.hockey?.games || []).length} · ncaa {(s.ncaafb?.games || []).length} · nfl {(s.nfl?.games || []).length} · tt {skGames}
          </b></div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--mono)" }}>
        QA suite: scripts/qa-checks.mjs — runs at every build and in the daily workflow; blocks deploys on invariant violations.
        Pipeline: refresh_forebet → fetch_oddschecker → fetch_setka → oracle_engine → score_espn → backfill → bundle → commit → auto-deploy (06:00 WAT + 00:10 WAT prices).
      </p>
    </div>
  );
}
