"""Win-check for the Naija Daily Picks app.

1. Re-downloads the 26/27 football-data.co.uk CSVs for the 11 covered
   leagues (direct download works from this machine).
2. For every covered game in daily/*.json whose date has a result,
   scores the model pick (1X2, Over 2.5, BTTS, DNB-home) and market pick.
3. Writes results/history.json with per-day + cumulative hit rates.

Run:  python3 app/results.py            (all dates in daily/)
      python3 app/results.py 2026-09-18 (one date)
"""
import io
import json
import os
import subprocess
import sys

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
import model as M
import model2 as M2

DATA = os.path.join(ROOT, "data")
RESULTS = os.path.join(HERE, "results")
SEASON = "2627"

CODES = {v: k for k, v in M.LEAGUES.items()}
CODES.update({v: k for k, v in M2.LEAGUES2.items()})


def fetch_season():
    for lg in CODES:
        url = f"https://www.football-data.co.uk/mmz4281/{SEASON}/{lg}.csv"
        raw = subprocess.run(
            ["curl", "-s", "-L", "--compressed", "-A", "Mozilla/5.0", url],
            capture_output=True, timeout=60).stdout
        if not raw.startswith(b"Div,Date"):
            print(f"  ! {lg}: no data (keeping local copy)")
            continue
        df = pd.read_csv(io.BytesIO(raw), usecols=[
            "HomeTeam", "AwayTeam", "Date", "FTHG", "FTAG", "HTHG", "HTAG"])
        df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y", errors="coerce")
        df.to_csv(os.path.join(DATA, f"{SEASON}_{lg}.csv"), index=False)


def load_results():
    frames = []
    for lg in CODES:
        p = os.path.join(DATA, f"{SEASON}_{lg}.csv")
        if not os.path.exists(p):
            continue
        df = pd.read_csv(p, parse_dates=["Date"])
        df = df[df["FTHG"].notna()]
        if df.empty:
            continue
        df["league"] = lg
        frames.append(df)
    if not frames:
        return None
    return pd.concat(frames)


def score_one(game, res):
    home, away = game["home"], game["away"]
    m = res[(res["league"] == game["league_code"]) &
            (res["HomeTeam"] == home) & (res["AwayTeam"] == away)]
    if m.empty:
        # try date-agnostic match (CSV date can differ by a day in odd TZs)
        m = res[(res["league"] == game["league_code"]) &
                (res["HomeTeam"] == home) & (res["AwayTeam"] == away) &
                (res["FTHG"].notna())]
    if m.empty or m.iloc[0]["FTHG"] is None or pd.isna(m.iloc[0]["FTHG"]):
        return None
    r = m.iloc[0]
    hg, ag = int(r["FTHG"]), int(r["FTAG"])
    full = "1" if hg > ag else ("X" if hg == ag else "2")
    model = game["model"]
    mkt = None
    if game.get("mkt"):
        dec = game["mkt_dec"]
        i = int(max(range(3), key=lambda i: dec[i]))
        mkt = "1" if i == 0 else ("X" if i == 1 else "2")
    total = hg + ag
    btts = 1 if (hg > 0 and ag > 0) else 0
    return dict(
        match=f"{home} v {away}", league=game["league"], score=f"{hg}-{ag}",
        full=full,
        model_pick=model["pick"], model_win=1 if model["pick"] == full else 0,
        market_pick=mkt, market_win=1 if (mkt and mkt == full) else 0,
        over25=1 if total > 2 else 0,
        model_over25_win=1 if (model["o25"] >= 0.5) == (total > 2) else 0,
        model_btts=1 if model["btts"] >= 0.5 else 0,
        btts_actual=btts,
        model_btts_win=1 if model["btts"] == btts else 0,
    )


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    fetch_season()
    res = load_results()
    if res is None:
        print("no result data yet")
        return
    os.makedirs(RESULTS, exist_ok=True)
    hist_path = os.path.join(RESULTS, "history.json")
    hist = json.load(open(hist_path)) if os.path.exists(hist_path) else {"days": {}, "cumulative": {}}

    for date in sorted(os.listdir(os.path.join(HERE, "daily"))):
        if not date.endswith(".json"):
            continue
        d = date[:-5]
        if only and d != only:
            continue
        day = json.load(open(os.path.join(HERE, "daily", date)))
        rows, n_res = [], 0
        for g in day["games"]:
            if not g.get("covered"):
                continue
            s = score_one(g, res)
            if s:
                rows.append(s)
                n_res += 1
        if rows:
            def rate(k):
                v = [r[k] for r in rows if r.get(k) is not None]
                return round(100 * sum(v) / len(v), 1) if v else None
            day_stats = dict(
                played=n_res, of=len(day["games"]),
                model_1x2=rate("model_win"),
                market_1x2=rate("market_win"),
                model_over25=rate("model_over25_win"),
                model_btts=rate("model_btts_win"),
            )
            hist["days"][d] = dict(stats=day_stats, rows=rows)

    # cumulative
    allrows = [r for d in hist["days"].values() for r in d["rows"]]
    if allrows:
        def rate(k):
            v = [r[k] for r in allrows if r.get(k) is not None]
            return round(100 * sum(v) / len(v), 1) if v else None
        hist["cumulative"] = dict(
            matches=len(allrows), days=len(hist["days"]),
            model_1x2=rate("model_win"), market_1x2=rate("market_win"),
            model_over25=rate("model_over25_win"),
            model_btts=rate("model_btts_win"),
        )
    json.dump(hist, open(hist_path, "w"), indent=1)
    print(json.dumps(hist["cumulative"], indent=1))
    for d, v in hist["days"].items():
        print(d, v["stats"])


if __name__ == "__main__":
    main()
