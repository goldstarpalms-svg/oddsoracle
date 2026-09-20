"""Backfill the track record with the data needed for a proper performance page.

For every scored row in results/history.json we attach (from the dated daily
boards, which are the auditable source of the prediction as published):
  model_prob  — the model's probability of the picked side (%)
  odds        — the market price at prediction time (or the fair price)
  profit      — + (odds - 1) units on a win, -1 unit on a loss (1-unit stake)

Then it rewrites the cumulative block with:
  win_rate, avg_odds, total_staked, profit_units, roi_pct, max_drawdown_units
and a calibration table (predicted probability bucket vs actual hit rate).

Idempotent. Run:  python3 backend/app/backfill_history.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
HIST = os.path.join(HERE, "results", "history.json")


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def find_game(day, home, away):
    """Return (model_prob_pick_pct, odds_pick) for a scored match on `day`."""
    model = None
    try:
        doc = json.load(open(os.path.join(DAILY, f"{day}.json")))
        for g in doc.get("games") or []:
            if norm(g["home"]) == norm(home) and norm(g["away"]) == norm(away):
                model = g
                break
    except Exception:
        pass
    board_row = None
    try:
        for r in json.load(open(os.path.join(DAILY, f"{day}_full_crack.json"))):
            if norm(r["home"]) == norm(home) and norm(r["away"]) == norm(away):
                board_row = r
                break
    except Exception:
        pass
    if not model:
        return None, None
    m = model["model"]
    probs = {"1": m["p1"], "X": m["px"], "2": m["p2"]}
    return probs, board_row


def main():
    hist = json.load(open(HIST))
    days = hist.get("days") or {}
    order = sorted(days.keys())
    for day in order:
        for r in days[day].get("rows") or []:
            h, a = str(r.get("match") or "").split(" v ", 1)
            pick = str(r.get("model_pick") or "")
            probs, board = find_game(day, h, a)
            if probs and pick in probs:
                p_pct = round(probs[pick] * 100, 1)
                r["model_prob"] = p_pct
                odds = None
                k1 = {"1": 0, "X": 1, "2": 2}[pick]
                mkt = (board or {}).get("mkt_dec")
                if isinstance(mkt, list) and len(mkt) == 3 and isinstance(mkt[k1], (int, float)) and mkt[k1] > 1:
                    odds = round(mkt[k1], 2)
                else:
                    odds = round(100 / p_pct, 2) if p_pct > 1 else None
                r["odds"] = odds
                r["fair_price"] = odds is not None and not (isinstance(mkt, list) and mkt[k1] > 1)
                won = bool(r.get("model_win"))
                r["profit"] = round(odds - 1, 2) if (won and odds) else -1
    # cumulative
    all_rows = [(d, r) for d in order for r in days[d].get("rows") or []]
    n = len(all_rows)
    wins = sum(1 for _, r in all_rows if r.get("model_win"))
    with_odds = [(d, r) for d, r in all_rows if r.get("odds")]
    staked = float(len(with_odds))
    profit = sum(float(r["profit"]) for _, r in with_odds)
    avg_odds = sum(float(r["odds"]) for _, r in with_odds) / len(with_odds) if with_odds else None
    roi = (profit / staked * 100) if staked else None
    # max drawdown on the chronological profit curve
    run, peak, dd = 0.0, 0.0, 0.0
    for _, r in with_odds:
        run += float(r["profit"])
        peak = max(peak, run)
        dd = max(dd, peak - run)
    # calibration buckets on the pick-side model probability
    buckets = [(50, 55), (55, 60), (60, 65), (65, 70), (70, 75), (75, 101)]
    cal = []
    for lo, hi in buckets:
        sel = [r for _, r in all_rows if r.get("model_prob") is not None and lo <= r["model_prob"] < hi]
        if sel:
            cal.append({
                "bucket": "75%+" if hi >= 101 else f"{lo}–{hi}%",
                "n": len(sel),
                "predicted": round(sum(r["model_prob"] for r in sel) / len(sel), 1),
                "actual": round(100 * sum(1 for r in sel if r.get("model_win")) / len(sel), 1),
            })
    hist["cumulative"] = {
        **{k: hist.get("cumulative", {}).get(k) for k in ("days",)},
        "matches": n,
        "model_1x2": round(100 * wins / n, 1) if n else None,
        "model_over25": hist.get("cumulative", {}).get("model_over25"),
        "model_btts": hist.get("cumulative", {}).get("model_btts"),
        "avg_odds": round(avg_odds, 2) if avg_odds else None,
        "total_staked": staked,
        "profit_units": round(profit, 2),
        "roi_pct": round(roi, 1) if roi is not None else None,
        "max_drawdown": round(dd, 2),
        "calibration": cal,
    }
    json.dump(hist, open(HIST, "w"), indent=1)
    c = hist["cumulative"]
    print(
        f"history backfilled: {n} rows · win {c['model_1x2']}% · avg odds {c['avg_odds']} · "
        f"profit {c['profit_units']}u · ROI {c['roi_pct']}% · maxDD {c['max_drawdown']}u · "
        f"calibration buckets: {len(cal)}"
    )


if __name__ == "__main__":
    main()
