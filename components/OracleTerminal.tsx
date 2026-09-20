import Link from "next/link";
import type { FbPick } from "@/lib/rich";

/**
 * ORACLE TERMINAL — Bloomberg-style strip of the model board:
 * today's signal counts + the highest-scoring games as a compact table.
 * Server component (static data from the snapshot).
 */
export default function OracleTerminal({ fb, totalEvents }: { fb: FbPick[]; totalEvents: number }) {
  const withOracle = fb.filter((p) => p.oracle);
  const nValue = withOracle.filter((p) => ["VALUE", "STRONG VALUE"].includes(p.oracle!.signal)).length;
  const nHigh = withOracle.filter((p) => (p.oracle!.confidence ?? 0) >= 80).length;
  const nPass = withOracle.filter((p) => ["PASS", "NO EDGE", "AVOID"].includes(p.oracle!.signal)).length;
  const rows = [...withOracle]
    .sort((a, b) => b.oracle!.oracle_score - a.oracle!.oracle_score)
    .slice(0, 8);

  const sigCls = (s: string) =>
    s === "STRONG VALUE" ? "sig-strong" : s === "VALUE" ? "sig-value" : s === "FAIR" ? "sig-fair" : s === "AVOID" ? "sig-avoid" : "sig-pass";

  return (
    <section className="sec-tight">
      <div className="container">
        <div className="terminal">
          <div className="terminal-head">
            <span className="terminal-title">
              <span className="terminal-dot" /> ORACLE TERMINAL — TODAY&rsquo;S MODEL BOARD
            </span>
            <Link href="/predictions/football/" className="terminal-link">
              Full football board →
            </Link>
          </div>
          <div className="terminal-stats">
            <div>
              <b>{totalEvents}</b>
              <span>events analyzed</span>
            </div>
            <div>
              <b className="sig-value-txt">{nValue}</b>
              <span>value signals</span>
            </div>
            <div>
              <b>{nHigh}</b>
              <span>high confidence (80%+)</span>
            </div>
            <div>
              <b>{nPass}</b>
              <span>passes / no edge</span>
            </div>
            <div>
              <b>{withOracle.length}</b>
              <span>engine-scored</span>
            </div>
          </div>
          <div className="terminal-scroll">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Model H/D/A</th>
                  <th>Market H/D/A</th>
                  <th>Edge</th>
                  <th>xG λ</th>
                  <th>Agree</th>
                  <th>Score</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const o = p.oracle!;
                  return (
                    <tr key={p.id}>
                      <td className="tt-match">
                        {p.home} <em>v</em> {p.away}
                      </td>
                      <td>
                        {o.model_probability[0]}/{o.model_probability[1]}/{o.model_probability[2]}
                      </td>
                      <td>{o.market_probability ? `${o.market_probability[0]}/${o.market_probability[1]}/${o.market_probability[2]}` : "—"}</td>
                      <td className={o.edge != null && o.edge >= 0 ? "edge-pos" : "edge-neg"}>
                        {o.edge == null ? "—" : `${o.edge >= 0 ? "+" : ""}${o.edge}pp`}
                      </td>
                      <td>
                        {o.lambda[0].toFixed(1)}–{o.lambda[1].toFixed(1)}
                      </td>
                      <td>{o.agreement}</td>
                      <td>
                        <b>{o.oracle_score}</b>
                      </td>
                      <td>
                        <span className={`oracle-signal ${sigCls(o.signal)}`}>{o.signal}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="terminal-foot">
            Oracle Score = analytical signal (edge + confidence + engine agreement + data quality) —
            <b> not</b> a chance of winning. The engine says PASS when there is no edge; that is
            discipline, not a missed game.
          </p>
        </div>
      </div>
    </section>
  );
}
