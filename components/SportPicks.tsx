"use client";

import { useMemo, useState } from "react";
import type { AmPick, BbPick, ComboLeg, FbPick, TnPick } from "@/lib/rich";
import { AmericanCard, BasketballCard, FootballCard, TennisCard } from "./RichCard";
import GameGate from "./GameGate";
import MarketBoard from "./MarketBoard";
import SNAPSHOT from "@/lib/data-snapshot.json";

const DATA_DATE = (SNAPSHOT as any).dataDate as string | null | undefined;

type AnyPick = FbPick | BbPick | TnPick | AmPick;
type Filter = "all" | "safe" | "value" | "scores";
type Sort = "time" | "prob" | "odds";
type OddsRange = "any" | "low" | "mid" | "high";

interface Props {
  sport: "football" | "basketball" | "tennis" | "other";
  items: AnyPick[];
  combo?: { legs: ComboLeg[]; totalOdds: number; allHitProb: number } | null;
}

const isFb = (p: AnyPick): p is FbPick => "fb_pct" in p || "model" in p;
const isBb = (p: AnyPick): p is BbPick => "fb_prob" in p && "deep" in p;
const isAm = (p: AnyPick): p is AmPick => (p as any).kind === "am";
const name2 = (p: AnyPick): [string, string] =>
  isFb(p) || isBb(p) || isAm(p) ? [(p as any).home, (p as any).away] : [(p as any).p1, (p as any).p2];
const hasScore = (p: AnyPick): boolean => {
  if (isFb(p)) return !!(p as FbPick).fb_score;
  if (isBb(p)) return !!(p as BbPick).fb_score;
  if (isAm(p)) return !!(p as AmPick).score;
  return !!(p as TnPick).sets;
};
const league = (p: AnyPick): string => {
  const v = (p as any).league || (p as any).tourn || "Other";
  return String(v);
};

const getOdds = (p: AnyPick): number | null => (p as any).odds ?? null;
const getProb = (p: AnyPick): number | null => (p as any).pickProb ?? null;
const getTime = (p: AnyPick): number => {
  const t = (p as any).t || "";
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9999;
};

const amSportKey = (p: AmPick): string =>
  p.sport === "MLB" || p.sport === "Baseball (Forebet)"
    ? "baseball"
    : p.sport === "Hockey"
      ? "hockey"
      : p.sport === "Handball"
        ? "handball"
        : p.sport === "American Football"
          ? "ncaafb"
          : "football";

export default function SportPicks({ sport, items, combo }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("time");
  const [oddsRange, setOddsRange] = useState<OddsRange>("any");
  const [market, setMarket] = useState<"cards" | "boards">("cards");

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "safe") list = list.filter((p) => (p as any).banker);
    else if (filter === "value") list = list.filter((p) => (p as any).value);
    else if (filter === "scores") list = list.filter(hasScore);

    // odds range
    if (oddsRange !== "any") {
      list = list.filter((p) => {
        const o = getOdds(p);
        if (o == null) return false;
        if (oddsRange === "low") return o >= 1.01 && o < 1.5;
        if (oddsRange === "mid") return o >= 1.5 && o < 2;
        return o >= 2;
      });
    }

    // sort (stable copy)
    const arr = [...list];
    if (sort === "prob") arr.sort((a, b) => (getProb(b) ?? -1) - (getProb(a) ?? -1));
    else if (sort === "odds") arr.sort((a, b) => (getOdds(b) ?? 0) - (getOdds(a) ?? 0));
    else arr.sort((a, b) => getTime(a) - getTime(b));
    return arr;
  }, [items, filter, oddsRange, sort]);

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
    const gate = (node: React.ReactNode) => {
      const t = (p as any).t as string | undefined;
      const gSport = isAm(p) ? amSportKey(p) : isFb(p) ? "football" : isBb(p) ? "basketball" : "tennis";
      const finalScore = (p as any).result as string | undefined;
      return (
        <GameGate t={t} dataDate={DATA_DATE} sport={gSport} final={finalScore} icon="🏁">
          {node}
        </GameGate>
      );
    };
    if (isFb(p)) return gate(<FootballCard key={p.id} p={p} />);
    if (isBb(p)) return gate(<BasketballCard key={p.id} p={p} />);
    if (isAm(p)) return gate(<AmericanCard key={p.id} p={p} />);
    return gate(<TennisCard key={(p as TnPick).id} p={p as TnPick} />);
  };

  const footballItems = sport === "football" ? (items as FbPick[]) : [];
  const showBoards = sport === "football" && market === "boards";

  return (
    <div>
      {/* DAILY COMBO */}
      {combo && combo.legs.length > 0 && sport === "football" && (
        <div className="combo-box">
          <div className="combo-head">
            <span className="combo-title">🔥 Today&rsquo;s Daily Combo ({combo.legs.length}-leg)</span>
            <span className="combo-total">
              @{combo.totalOdds.toFixed(2)} · <small>{combo.allHitProb}% to land all</small>
            </span>
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

      {/* VIEW SWITCH (football): full cards vs forebet-style market boards */}
      {sport === "football" && (
        <div className="view-switch" role="tablist" aria-label="View">
          <button
            role="tab"
            aria-selected={market === "cards"}
            className={`filter-tab ${market === "cards" ? "active" : ""}`}
            onClick={() => setMarket("cards")}
          >
            🃏 Cards
          </button>
          <button
            role="tab"
            aria-selected={market === "boards"}
            className={`filter-tab ${market === "boards" ? "active" : ""}`}
            onClick={() => setMarket("boards")}
          >
            📊 Market boards (like Forebet)
          </button>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="filter-tabs" role="tablist" aria-label="Filter picks">
        {(
          [
            ["all", `All (${counts.all})`],
            ["safe", `🏦 High confidence (${counts.safe})`],
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

      {/* SORT + ODDS RANGE */}
      <div className="sort-row">
        <label className="sort-ctl">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="time">Kickoff time</option>
            <option value="prob">Model probability ↓</option>
            <option value="odds">Odds ↓</option>
          </select>
        </label>
        <label className="sort-ctl">
          <span>Odds</span>
          <select value={oddsRange} onChange={(e) => setOddsRange(e.target.value as OddsRange)}>
            <option value="any">Any</option>
            <option value="low">1.01 – 1.49</option>
            <option value="mid">1.50 – 1.99</option>
            <option value="high">2.00 +</option>
          </select>
        </label>
        <span className="sort-count">{filtered.length} shown</span>
      </div>

      {/* LEGEND (plain words) */}
      <div className="legend">
        <b>Read it like this:</b> the bar shows the chance each outcome happens — the lit part is
        the pick. <b>🏦 Banker</b> = model confidence of 70%+ (a statistical label, not a guarantee).{" "}
        <b>💎 Value</b> = the price looks generous for the risk. <b>@1.85</b> = bet ₦100, win and
        you get ₦185 back (₦85 profit). Percentages are model estimates.
      </div>

      {showBoards ? (
        <MarketBoard items={footballItems} />
      ) : filtered.length === 0 ? (
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
