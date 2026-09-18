import type { BbPick, FbPick, TnPick } from "@/lib/rich";

/** Three-segment (1/X/2) or two-segment (home/away) probability bar. */
export function ProbBar({
  pct,
  picked,
  labels,
}: {
  pct: (number | null)[]; // e.g. [58, 24, 18]
  picked: string; // which key is picked: "1" | "X" | "2" / "h" | "a"
  labels: string[];
}) {
  const keys = pct.length === 3 ? ["1", "X", "2"] : ["h", "a"];
  return (
    <div className="probbar" aria-label={labels.join(" ")}>
      <div className="probbar-segs">
        {pct.map((v, i) => {
          const w = v == null ? 0 : Math.max(2, Math.min(100, v));
          const isPick = keys[i] === picked;
          return (
            <div
              key={i}
              className={`probbar-seg seg-${keys[i]} ${isPick ? "picked" : ""}`}
              style={{ width: `${w}%` }}
              title={`${labels[i]}: ${v ?? "—"}%`}
            />
          );
        })}
      </div>
      <div className="probbar-labels">
        {labels.map((l, i) => (
          <span key={i} className={keys[i] === picked ? "picked" : ""}>
            {l} · {pct[i] ?? "—"}%
          </span>
        ))}
      </div>
    </div>
  );
}

function OddsChip({ odds }: { odds: number | null }) {
  return (
    <span className={`odds-chip ${odds != null && odds >= 1.8 ? "odds-hot" : ""}`}>
      {odds != null ? `@${odds.toFixed(2)}` : "odds —"}
    </span>
  );
}

function Badges({ banker, value, extra }: { banker?: boolean; value?: boolean; extra?: string }) {
  if (!banker && !value && !extra) return null;
  return (
    <div className="rich-badges">
      {banker && <span className="badge badge-banker">🏦 BANKER</span>}
      {value && <span className="badge badge-value">💎 VALUE</span>}
      {extra && <span className="badge badge-src">{extra}</span>}
    </div>
  );
}

const srcBadge = (src: string): string | null =>
  src === "FOREBET" ? "FOREBET PICK" : src === "MODEL" ? "MODEL PICK" : src === "FUSION" ? "FUSION ✓" : null;

export function FootballCard({ p }: { p: FbPick }) {
  const pickedKey = p.final.startsWith("Home") ? "1" : p.final.startsWith("Away") ? "2" : "X";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.league}</span>
        <span className="kickoff">⏰ {p.t} WAT</span>
        {srcBadge(p.src) && <span className="badge badge-src">{srcBadge(p.src)}</span>}
      </div>

      <div className="rich-teams">
        <span>{p.home}</span>
        <span className="pred-vs">vs</span>
        <span>{p.away}</span>
      </div>

      {p.fb_pct ? (
        <ProbBar pct={[p.fb_pct[0], p.fb_pct[1], p.fb_pct[2]]} picked={pickedKey} labels={["1 (Home)", "X (Draw)", "2 (Away)"]} />
      ) : (
        p.model?.p && <ProbBar pct={[p.model.p[0], p.model.p[1], p.model.p[2]]} picked={pickedKey} labels={["1 (Home)", "X (Draw)", "2 (Away)"]} />
      )}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.final}</span>
        <OddsChip odds={p.odds} />
        {p.fb_score && <span className="score-chip">⚽ {p.fb_score}</span>}
        {p.ou && <span className="score-chip">Σ {p.ou}</span>}
      </div>

      {p.model && (p.model.o25 != null || p.model.btts != null) && (
        <div className="rich-model">
          Model: 1/X/2 {p.model.p ? `${p.model.p[0]} / ${p.model.p[1]} / ${p.model.p[2]}` : "—"}
          {p.model.o25 != null && <> · O2.5 <b>{p.model.o25}%</b></>}
          {p.model.btts != null && <> · BTTS <b>{p.model.btts}%</b></>}
          {p.model.bank && p.model.bank !== "SAFE" && <> · <b>{p.model.bank}</b></>}
        </div>
      )}

      <Badges banker={p.banker} value={p.value} />
    </article>
  );
}

export function BasketballCard({ p }: { p: BbPick }) {
  const pickedKey = /^1/.test(String(p.fb_pick || p.pick)) ? "h" : "a";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""} ${p.deep ? "rich-deep" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.league}</span>
        <span className="kickoff">⏰ {p.t} WAT</span>
        {p.deep && <span className="badge badge-src">DEEP CRACK</span>}
      </div>

      <div className="rich-teams">
        <span>{p.home}</span>
        <span className="pred-vs">vs</span>
        <span>{p.away}</span>
      </div>

      {p.fb_prob ? (
        <ProbBar pct={[p.fb_prob[0], p.fb_prob[1]]} picked={pickedKey} labels={["Home", "Away"]} />
      ) : null}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.pick || "—"}</span>
        <OddsChip odds={p.odds} />
        {p.fb_score && <span className="score-chip">🏀 {p.fb_score}</span>}
        {p.fb_avg != null && <span className="score-chip">Σ avg {p.fb_avg}</span>}
      </div>

      {p.conf && <div className="rich-model">Forebet confidence: <b>{p.conf}</b></div>}
      {p.why && <p className="rich-why">{p.why}</p>}

      <Badges banker={p.banker} value={p.value} />
    </article>
  );
}

export function TennisCard({ p }: { p: TnPick }) {
  const pickedKey = /^1/.test(String(p.pred)) ? "h" : "a";
  return (
    <article className={`rich-card ${p.banker ? "rich-banker" : ""}`}>
      <div className="rich-top">
        <span className="league">{p.tourn}</span>
        <span className="kickoff">⏰ {p.t} WAT</span>
      </div>

      <div className="rich-teams">
        <span>{p.p1}</span>
        <span className="pred-vs">vs</span>
        <span>{p.p2}</span>
      </div>

      {p.prob ? (
        <ProbBar pct={[p.prob[0], p.prob[1]]} picked={pickedKey} labels={["Player 1", "Player 2"]} />
      ) : null}

      <div className="rich-pick-row">
        <span className="rich-tip">{p.pred || "—"}</span>
        <OddsChip odds={p.odds} />
        {p.sets && <span className="score-chip">🎾 sets {p.sets}</span>}
      </div>

      <Badges banker={p.banker} value={p.value} />
    </article>
  );
}
