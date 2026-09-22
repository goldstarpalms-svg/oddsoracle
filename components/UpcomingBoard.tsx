import { loadUpcoming } from "@/lib/localData";
import { fmtPct } from "@/lib/value";
import Link from "next/link";

/**
 * Real upcoming fixtures, fetched from keyless sources. Where a bookmaker
 * price exists we show the market too; where it doesn't, we say NO PRICE
 * rather than dressing up a number we don't have.
 */
export default function UpcomingBoard({ limit = 30 }: { limit?: number }) {
  const events = loadUpcoming(limit);
  if (events.length === 0) {
    return (
      <div className="ds-state">
        <div className="ds-state-title">No upcoming fixtures loaded</div>
        <div>The fixture feed has not run yet. Nothing is shown rather than guessing.</div>
      </div>
    );
  }

  const priced = events.filter((e) => e.odds).length;

  return (
    <div>
      <p className="ds-meta" style={{ marginBottom: "var(--s-3)" }}>
        {events.length} upcoming fixtures · {priced} with bookmaker prices attached
      </p>
      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Kickoff</th>
              <th>League</th>
              <th>Fixture</th>
              <th className="right">Model 1X2</th>
              <th className="right">Market</th>
              <th className="right">Best price</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{e.kickoff_label}</td>
                <td>{e.league}</td>
                <td style={{ color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {e.home} <span style={{ color: "var(--text-3)" }}>v</span> {e.away}
                </td>
                <td className="right num">
                  {e.model_prob ? e.model_prob.map((p) => `${Math.round(p * 100)}`).join(" / ") : "—"}
                </td>
                <td className="right num">
                  {e.market_prob ? e.market_prob.map((p) => `${Math.round(p * 100)}`).join(" / ") : "—"}
                </td>
                <td className="right">
                  {e.odds?.best?.[0] ? (
                    <span className="num">{e.odds.best.map((v) => (v ? v.toFixed(2) : "—")).join(" / ")}</span>
                  ) : (
                    <span className="badge badge-pass">NO PRICE</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="ds-meta" style={{ marginTop: "var(--s-3)" }}>
        Model numbers are estimates from match data, not predictions of a result. Prices appear
        once the bookmaker feeds publish them for each fixture — see the{" "}
        <Link href="/board/" style={{ color: "var(--accent)" }}>Oracle Board</Link> for priced markets.
      </p>
    </div>
  );
}
