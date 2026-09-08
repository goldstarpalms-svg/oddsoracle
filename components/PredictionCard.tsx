import type { Prediction } from "@/lib/predictions";

const confClass: Record<string, string> = {
  High: "conf-high",
  Balanced: "conf-balanced",
  Value: "conf-value",
};

export default function PredictionCard({ p }: { p: Prediction }) {
  return (
    <article className="pred-card">
      <div className="pred-top">
        <span className="league">{p.league}</span>
        <span className="kickoff">{p.kickoff}</span>
      </div>

      <div className="pred-teams">
        <span className="pred-team">{p.home}</span>
        <span className="pred-vs">vs</span>
        <span className="pred-team">{p.away}</span>
      </div>

      <div className="pred-body">
        <div className="pred-market">{p.market}</div>
        <div className="pred-tip-row">
          <span className="pred-tip grad-text">{p.tip}</span>
          <span className="pred-odds">@{p.odds}</span>
        </div>
      </div>

      <div className="pred-foot">
        <span className={`conf ${confClass[p.confidence]}`}>{p.confidence} confidence</span>
      </div>

      <p className="analysis">{p.analysis}</p>
    </article>
  );
}
