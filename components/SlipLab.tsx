"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { analyseSlip, decodeSlip, encodeSlip, independenceCaveat, type SlipLeg } from "@/lib/sliplab";

/**
 * Slip Lab — the flagship tool.
 *
 * It makes no prediction and needs no data feed. You tell it what you're
 * betting; it tells you what that actually costs and what it's actually worth.
 * Works with any bookmaker's slip, which is why it's the most useful thing on
 * the site while the data pipeline is being rebuilt.
 */

const BLANK = { event: "", market: "", selection: "", odds: "", prob: "" };

export default function SlipLab() {
  const [legs, setLegs] = useState<SlipLeg[]>([]);
  const [form, setForm] = useState(BLANK);
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  // A shared slip lives entirely in the URL — no account, no database.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    if (s) {
      const decoded = decodeSlip(s);
      if (decoded.length) {
        setLegs(decoded);
        setShared(true);
      }
    }
  }, []);

  const analysis = useMemo(() => analyseSlip(legs), [legs]);
  const caveat = independenceCaveat(analysis);

  const addLeg = () => {
    const odds = Number(form.odds);
    if (!form.event.trim() || !Number.isFinite(odds) || odds <= 1) return;
    const prob = form.prob === "" ? null : Number(form.prob) / 100;
    setLegs((prev) => [
      ...prev,
      {
        id: `leg-${Date.now()}-${prev.length}`,
        event: form.event.trim(),
        market: form.market.trim() || "Selection",
        selection: form.selection.trim() || form.event.trim(),
        odds,
        modelProb: prob != null && Number.isFinite(prob) && prob > 0 && prob < 1 ? prob : null,
      },
    ]);
    setForm(BLANK);
  };

  const addBulk = () => {
    const rows = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed: SlipLeg[] = [];
    for (const r of rows) {
      const parts = r.split(/[,\t|]/).map((p) => p.trim());
      if (parts.length < 2) continue;
      // "Event, Selection, Odds"  |  "Event, Market, Selection, Odds"
      const oddsIdx = parts.findIndex((p) => /^\d+(\.\d+)?$/.test(p) && Number(p) > 1);
      if (oddsIdx < 1) continue;
      const odds = Number(parts[oddsIdx]);
      const event = parts[0];
      const selection = oddsIdx >= 3 ? parts[oddsIdx - 1] : parts[1];
      const market = oddsIdx >= 3 ? parts[1] : "Selection";
      parsed.push({
        id: `leg-${Date.now()}-${parsed.length}`,
        event, market, selection, odds, modelProb: null,
      });
    }
    if (parsed.length) {
      setLegs((prev) => [...prev, ...parsed]);
      setBulk("");
      setShowBulk(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/slip-lab/?s=${encodeSlip(legs)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  return (
    <div>
      <section className="hero-4">
        <div className="container">
          <p className="ds-eyebrow" style={{ marginBottom: "var(--s-3)" }}>Slip Lab</p>
          <h1 className="ds-display" style={{ marginBottom: "var(--s-4)" }}>
            Check any slip before you stake it
          </h1>
          <p className="ds-body" style={{ fontSize: "1.0625rem", maxWidth: 720 }}>
            Paste your accumulator from any bookmaker. We do the arithmetic you were
            never shown: the true combined odds, how much the bookmaker is taking,
            how correlation between legs drags the real chance down, and what a stake
            that won&rsquo;t wreck your bankroll looks like.
          </p>
          <p className="ds-meta" style={{ marginTop: "var(--s-3)" }}>
            No predictions. No tips. Nothing here tells you what to bet — it tells you
            what you&rsquo;re actually paying for.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container" style={{ display: "grid", gap: "var(--s-4)", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)", alignItems: "start" }}>
          <style>{`@media (max-width: 900px){ .sliplab-cols { grid-template-columns: 1fr !important; } }`}</style>

          {/* ---------- builder ---------- */}
          <div className="ds-panel sliplab-cols" style={{ padding: "var(--s-4)", display: "grid", gap: "var(--s-3)", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <p className="ds-eyebrow">Your legs</p>
              {shared && (
                <p className="ds-meta" style={{ marginTop: 6 }}>
                  This is a shared slip, loaded read-only from the link. Edit your own copy below.
                </p>
              )}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <input
                className="ds-input" placeholder="Event — e.g. Arsenal v Chelsea"
                value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  className="ds-input" placeholder="Market (1X2, O2.5…)"
                  value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })}
                />
                <input
                  className="ds-input" placeholder="Selection (Draw)"
                  value={form.selection} onChange={(e) => setForm({ ...form, selection: e.target.value })}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                <input
                  className="ds-input num" type="number" step="0.01" min="1.01" placeholder="Odds 3.40"
                  value={form.odds} onChange={(e) => setForm({ ...form, odds: e.target.value })}
                />
                <input
                  className="ds-input num" type="number" step="1" min="1" max="99" placeholder="Your est. % (optional)"
                  value={form.prob} onChange={(e) => setForm({ ...form, prob: e.target.value })}
                />
                <button className="ds-btn ds-btn-primary" onClick={addLeg}>Add</button>
              </div>

              <button className="ds-btn ds-btn-sm" onClick={() => setShowBulk((s) => !s)}>
                {showBulk ? "Hide paste box" : "Paste several legs at once"}
              </button>
              {showBulk && (
                <div style={{ display: "grid", gap: 8 }}>
                  <textarea
                    className="ds-input" rows={4}
                    style={{ height: "auto", padding: "var(--s-2)" }}
                    placeholder={"One leg per line:\nArsenal v Chelsea, Draw, 3.40\nMan City v Spurs, Over 2.5, 1.85"}
                    value={bulk} onChange={(e) => setBulk(e.target.value)}
                  />
                  <button className="ds-btn ds-btn-sm" onClick={addBulk}>Add these legs</button>
                </div>
              )}
            </div>

            {/* ---------- analysis ---------- */}
            <div className="ds-panel-elevated" style={{ padding: "var(--s-4)" }}>
              <p className="ds-eyebrow">The maths</p>
              {legs.length === 0 ? (
                <p className="ds-meta" style={{ marginTop: 10 }}>
                  Add a leg and the numbers appear here.
                </p>
              ) : (
                <>
                  <dl className="ds-kv" style={{ marginTop: 10 }}>
                    <dt>Legs</dt><dd>{analysis.legs}</dd>
                    <dt>Combined odds</dt><dd>{analysis.combinedOdds?.toFixed(2) ?? "—"}</dd>
                    <dt>Combined chance</dt>
                    <dd>{analysis.combinedProb == null ? "—" : `${(analysis.combinedProb * 100).toFixed(1)}%`}</dd>
                    {analysis.combinedProbLow != null && (
                      <>
                        <dt>If legs correlate</dt>
                        <dd>↓ {(analysis.combinedProbLow * 100).toFixed(1)}%</dd>
                      </>
                    )}
                    <dt>Fair odds</dt><dd>{analysis.fairOdds?.toFixed(2) ?? "—"}</dd>
                    <dt>Bookmaker margin</dt>
                    <dd style={{ color: analysis.marginPct && analysis.marginPct > 12 ? "var(--negative)" : undefined }}>
                      {analysis.marginPct == null ? "—" : `${analysis.marginPct.toFixed(1)}%`}
                    </dd>
                  </dl>

                  {analysis.weakestLeg && (
                    <p className="ds-meta" style={{ marginTop: 10 }}>
                      Weakest leg: {analysis.weakestLeg.selection} ({((analysis.weakestLeg.modelProb ?? 0) * 100).toFixed(0)}%)
                      {analysis.strongestLeg && analysis.strongestLeg !== analysis.weakestLeg && (
                        <> · Strongest: {analysis.strongestLeg.selection} ({((analysis.strongestLeg.modelProb ?? 0) * 100).toFixed(0)}%)</>
                      )}
                    </p>
                  )}

                  {analysis.correlated.length > 0 && (
                    <div className="ds-state" style={{ textAlign: "left", marginTop: 12, borderColor: "var(--warning)" }}>
                      <div className="ds-state-title">Correlated legs</div>
                      {analysis.correlated.map((c, i) => (
                        <div key={i}>{c.a} + {c.b} — {c.reason}</div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <span className={`badge ${analysis.risk === "LOWER MODEL RISK" ? "badge-value" : analysis.risk === "HIGHER MODEL RISK" ? "badge-fair" : "badge-pass"}`}>
                      {analysis.risk}
                    </span>
                  </div>
                  <p className="ds-meta" style={{ marginTop: 8 }}>{analysis.riskNote}</p>

                  {analysis.stakePct != null && (
                    <div className="stake-row">
                      <span className="k">Safer stake &middot; &frac14; Kelly, capped 2%</span>
                      <span className="v">{(analysis.stakePct * 100).toFixed(2)}% &middot; &#8358;{analysis.stakeNgn?.toLocaleString()}</span>
                    </div>
                  )}

                  <button className="ds-btn ds-btn-sm" style={{ width: "100%", marginTop: 12 }} onClick={share}>
                    {copied ? "Link copied ✓" : "Copy shareable link"}
                  </button>
                </>
              )}
            </div>

            {/* ---------- leg list ---------- */}
            <div style={{ gridColumn: "1 / -1" }}>
              {legs.length > 0 && (
                <div className="ds-table-wrap">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Event</th><th>Market</th><th>Selection</th>
                        <th className="right">Odds</th><th className="right">Est.</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {legs.map((l) => (
                        <tr key={l.id}>
                          <td>{l.event}</td>
                          <td>{l.market}</td>
                          <td style={{ color: "var(--text)" }}>{l.selection}</td>
                          <td className="right num">{l.odds.toFixed(2)}</td>
                          <td className="right num">{l.modelProb ? `${(l.modelProb * 100).toFixed(0)}%` : "—"}</td>
                          <td className="right">
                            <button className="ds-btn ds-btn-sm" onClick={() => setLegs((p) => p.filter((x) => x.id !== l.id))}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {legs.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button className="ds-btn ds-btn-sm" onClick={() => { setLegs([]); setShared(false); }}>
                    Clear slip
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="container prose" style={{ maxWidth: 800 }}>
          <h2 style={{ color: "var(--text)" }}>How to read this</h2>
          <p className="ds-body">
            Every bookmaker shows you the combined odds of an accumulator because big numbers sell
            tickets. What they don&rsquo;t show is the margin compounding across every leg — a five-leg
            slip can quietly hand back 20% of your money before a ball is kicked — or the way
            correlation between legs makes the true chance lower than the multiplied figure.
          </p>
          <p className="ds-body" style={{ marginTop: 12 }}>
            {caveat}
          </p>
          <div className="callout" style={{ marginTop: 14 }}>
            This tool does not predict anything and will never tell you a slip is safe. It tells you
            the price you are paying and the discipline that keeps you in the game. If you are
            staking money you need for something else, no tool here will help you — stop.
          </div>
          <p className="ds-meta" style={{ marginTop: 14 }}>
            Looking for the model&rsquo;s read instead? See the <Link href="/board/" style={{ color: "var(--accent)" }}>Oracle Board</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
