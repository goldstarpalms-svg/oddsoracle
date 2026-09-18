"use client";

import { useMemo, useState } from "react";
import type { BbPick, ComboLeg, FbPick, TnPick } from "@/lib/rich";
import { BasketballCard, FootballCard, TennisCard } from "./RichCard";

type AnyPick = FbPick | BbPick | TnPick;
type Filter = "all" | "safe" | "value" | "scores";

interface Props {
  sport: "football" | "basketball" | "tennis";
  items: AnyPick[];
  combo?: { legs: ComboLeg[]; totalOdds: number } | null;
}

const isFb = (p: AnyPick): p is FbPick => "fb_pct" in p || "model" in p;
const isBb = (p: AnyPick): p is BbPick => "fb_prob" in p && "deep" in p;
const name2 = (p: AnyPick): [string, string] =>
  isFb(p) || isBb(p) ? [(p as any).home, (p as any).away] : [(p as any).p1, (p as any).p2];
const hasScore = (p: AnyPick): boolean => {
  if (isFb(p)) return !!(p as FbPick).fb_score;
  if (isBb(p)) return !!(p as BbPick).fb_score;
  return !!(p as TnPick).sets;
};
const league = (p: AnyPick): string => {
  const v = (p as any).league || (p as any).tourn || "Other";
  return String(v);
};

export default function SportPicks({ sport, items, combo }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "safe") return items.filter((p) => (p as any).banker);
    if (filter === "value") return items.filter((p) => (p as any).value);
    return items.filter(hasScore);
  }, [items, filter]);

  // group by league, keep order of first appearance
  const groups = useMemo(() => {
    const map = new Map<string, AnyPick[]>();
    for (const p of filtered) {
      const lg = league(p);
      if (!map.has(lg)) map.set(lg, []);
      map.get(lg)!.push(p);
    }
      return Array.from(map.entries());
  }, [filtered]);

  const counts = {
    all: items.length,
    safe: items.filter((p) => (p as any).banker).length,
    value: items.filter((p) => (p as any).value).length,
    scores: items.filter(hasScore).length,
  };

  const renderCard = (p: AnyPick) => {
    if (isFb(p)) return <FootballCard key={p.id} p={p} />;
    if (isBb(p)) return <BasketballCard key={p.id} p={p} />;
    return <TennisCard key={(p as TnPick).id} p={p as TnPick} />;
  };

  return (
    <div>
      {/* DAILY COMBO */}
      {combo && combo.legs.length > 0 && sport === "football" && (
        <div className="combo-box">
          <div className="combo-head">
            <span className="combo-title">🔥 Today&rsquo;s Safe Combo ({combo.legs.length}-leg)</span>
            <span className="combo-total">@{combo.totalOdds.toFixed(2)}</span>
          </div>
          <div className="combo-legs">
            {combo.legs.map((l, i) => (
              <div className="combo-leg" key={l.id}>
                <span className="combo-leg-n">{i + 1}</span>
                <span className="combo-leg-match">
                  {l.home} <em>vs</em> {l.away}
                </span>
                <span className="combo-leg-pick">{l.pick}</span>
                <span className="combo-leg-odds">@{l.odds.toFixed(2)}</span>
                <span className="combo-leg-prob">{l.prob}%</span>
              </div>
            ))}
          </div>
          <p className="combo-note">
            Simple rule: this combo only makes sense if you take ALL the legs. Stake it small —
            1 unit max — because every extra leg multiplies the risk.
          </p>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="filter-tabs" role="tablist" aria-label="Filter picks">
        {(
          [
            ["all", `All (${counts.all})`],
            ["safe", `🏦 Safe picks (${counts.safe})`],
            ["value", `💎 Value (${counts.value})`],
            ["scores", `⚽ Score calls (${counts.scores})`],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* LEGEND (plain words) */}
      <div className="legend">
        <b>Read it like this:</b> the bar shows the chance each outcome happens — green = the pick.
        <b> 🏦 Banker</b> = the safest one of the day (70%+ chance). <b>💎 Value</b> = the odds are
        fatter than the risk. <b>@1.85</b> = if you bet ₦100 and win, you get ₦185 back (₦85 profit).
      </div>

      {filtered.length === 0 ? (
        <div className="callout callout-blue">
          No picks match this filter today — switch to “All” to see every game.
        </div>
      ) : (
        <div className="league-groups">
          {groups.map(([lg, picks]) => (
            <section className="league-group" key={lg}>
              <div className="league-head">
                <h3>{lg}</h3>
                <span className="league-count">{picks.length} game{picks.length > 1 ? "s" : ""}</span>
              </div>
              <div className="pred-grid">{picks.map(renderCard)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
