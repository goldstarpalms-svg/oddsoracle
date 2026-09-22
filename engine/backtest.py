"""
Walk-forward validation for engine v2.

Nothing here is optional: a model is only shipped if, on data it has never
seen, it beats the de-vigged market on log loss AND makes money at closing
odds. If it fails either test, the honest answer is "it doesn't work".
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from core import PoissonDC, load_matches, rolling_features

EPS = 1e-9


def devig(row) -> np.ndarray | None:
    o = [row.get("B365H"), row.get("B365D"), row.get("B365A")]
    if any(v is None or not np.isfinite(v) or v <= 1 for v in o):
        return None
    imp = np.array([1 / v for v in o])
    return imp / imp.sum()


def metrics(y: np.ndarray, p: np.ndarray) -> dict:
    p = np.clip(p, EPS, 1 - EPS)
    logloss = -np.mean(np.log(p[np.arange(len(y)), y]))
    brier = np.mean(np.sum((np.eye(3)[y] - p) ** 2, axis=1))
    return {"logloss": float(logloss), "brier": float(brier)}


def bet_roi(rows: list[dict], min_edge_pp: float) -> dict:
    """Flat 1u stakes whenever the model's edge clears the threshold."""
    stakes = wins = 0
    pnl = 0.0
    for r in rows:
        if r["edge"] >= min_edge_pp / 100.0:
            stakes += 1
            odds = r["odds"]
            pnl += (odds - 1) if r["win"] else -1
            wins += 1 if r["win"] else 0
    if stakes == 0:
        return {"bets": 0, "roi": None, "hit": None}
    return {"bets": stakes, "roi": pnl / stakes * 100, "hit": wins / stakes * 100}


def run(folds: int = 4, sot_weight: float = 0.35, verbose: bool = True):
    df = load_matches()
    if df.empty:
        print("no data")
        return None

    df = df[df["B365H"].notna() & df["B365D"].notna() & df["B365A"].notna()]
    df = df.sort_values("Date").reset_index(drop=True)
    n = len(df)
    if verbose:
        print(f"matches with closing odds: {n} | {df['league'].nunique()} competitions | "
              f"{df['Date'].min().date()} -> {df['Date'].max().date()}")

    fold_bounds = np.linspace(0, n, folds + 1).astype(int)
    all_model, all_market, all_bets = [], [], []

    for k in range(1, folds):
        train_end = fold_bounds[k]
        test = df.iloc[fold_bounds[k]:fold_bounds[k + 1]]
        if len(test) < 30:
            continue
        train = df.iloc[:train_end]

        models = {}
        for lg, g in train.groupby("league"):
            if len(g) < 120:
                continue
            m = PoissonDC(sot_weight=sot_weight).fit(g)
            if m.att_ is not None:
                models[lg] = m

        for _, r in test.iterrows():
            dv = devig(r)
            if dv is None:
                continue
            m = models.get(r["league"])
            pr = m.probs(r["home"], r["away"]) if m else None
            if pr is None:
                continue
            pm = np.array(pr[:3])
            pm = pm / pm.sum()

            result = 0 if r["FTHG"] > r["FTAG"] else (1 if r["FTHG"] == r["FTAG"] else 2)
            all_model.append((result, pm, r["Date"]))
            all_market.append((result, dv, r["Date"]))

            sel = int(np.argmax(pm))
            all_bets.append({
                "edge": pm[sel] - dv[sel],
                "odds": float([r["B365H"], r["B365D"], r["B365A"]][sel]),
                "win": sel == result,
            })

    if not all_model:
        print("no scored matches")
        return None

    y = np.array([a[0] for a in all_model])
    p_model = np.array([a[1] for a in all_model])
    p_market = np.array([a[1] for a in all_market])

    mm = metrics(y, p_model)
    mk = metrics(y, p_market)

    print(f"\nscored matches (out-of-sample): {len(y)}")
    print(f"  model  log-loss {mm['logloss']:.4f}  brier {mm['brier']:.4f}")
    print(f"  market log-loss {mk['logloss']:.4f}  brier {mk['brier']:.4f}")
    delta = mk["logloss"] - mm["logloss"]
    print(f"  -> model beats market by {delta:+.4f} log-loss "
          f"({'YES' if delta > 0 else 'NO — market wins'})")

    # blend sweep: how much of the model to mix into the market number
    print("\n  blend sweep (model weight vs market):")
    best = None
    for w in (0.0, 0.25, 0.5, 0.75, 1.0):
        p = (1 - w) * p_market + w * p_model
        p = p / p.sum(axis=1, keepdims=True)
        ll = metrics(y, p)["logloss"]
        flag = ""
        if best is None or ll < best[1]:
            best = (w, ll)
        print(f"    w={w:.2f}  log-loss {ll:.4f}")
    print(f"  -> best blend weight: {best[0]:.2f} (log-loss {best[1]:.4f})")

    print("\n  staking simulation (flat 1u, bet when edge clears threshold):")
    for thr in (0, 3, 5, 8):
        r = bet_roi(all_bets, thr)
        if r["bets"] == 0:
            print(f"    edge >={thr}pp: no bets")
            continue
        roi = r["roi"]
        print(f"    edge >={thr}pp: {r['bets']:5} bets | hit {r['hit']:.1f}% | "
              f"ROI {roi:+.2f}%  {'✅' if roi > 0 else '❌'}")

    # calibration buckets on the pure model
    print("\n  calibration (model probability vs actual frequency):")
    conf = np.max(p_model, axis=1)
    hit = (np.argmax(p_model, axis=1) == y)
    edges = [0.30, 0.40, 0.50, 0.60, 0.70, 1.01]
    for lo, hi in zip(edges[:-1], edges[1:]):
        m_ = (conf >= lo) & (conf < hi)
        if m_.sum() < 20:
            continue
        print(f"    {int(lo*100)}-{int(hi*100)}%: n={m_.sum():4}  "
              f"predicted {conf[m_].mean()*100:.1f}%  actual {hit[m_].mean()*100:.1f}%")

    return {"model": mm, "market": mk, "delta": delta, "best_blend": best}


if __name__ == "__main__":
    run()
