"""Score our picks against ESPN's official final scores (works when forebet
blocks us). ESPN's open scoreboard API is reachable from cloud IPs.

Covers:
  Football (main board): D1 ger.1  E0 eng.1  E1 eng.2  F1 fra.1  I1 ita.1
    I2 ita.2  NL1 ned.1  SC0 sco.1  SP1 esp.1  SP2 esp.2  TR1 tur.1
  NCAAF     (<date>_ncaafb.json):     football/college-football (NCAA)
  Hockey    (<date>_hockey.json):     hockey/nhl                (NHL)
  Baseball  (<date>_baseball.json):   baseball/mlb              (MLB)
  Basketball(<date>_basketball.json): basketball/wnba           (WNBA)
  NFL       (<date>_nfl.json, 25/9+): football/nfl              (NFL)

Non-soccer files settle as the moneyline (1 = home, 2 = away); O/U and BTTS
are soccer-only. ESPN uses US dates, so each query also checks the next US
date for late games.

Run:  python3 score_espn.py            (all dated daily model files)
      python3 score_espn.py 2026-09-19 (one date)
"""
import io
import json
import os
import re
import subprocess
from datetime import datetime, timedelta

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
RESULTS = os.path.join(HERE, "results")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"}

ESPN = {
    "D1": "ger.1", "E0": "eng.1", "E1": "eng.2", "F1": "fra.1",
    "I1": "ita.1", "I2": "ita.2", "NL1": "ned.1", "SC0": "sco.1",
    "SP1": "esp.1", "SP2": "esp.2", "TR1": "tur.1",
}

# (file suffix, sport label, ESPN sport path, board league names to score)
OTHER_SPORTS = [
    ("_ncaafb.json", "NCAAF", "football/college-football", ["NCAA"]),
    ("_hockey.json", "Hockey", "hockey/nhl", ["NHL"]),
    ("_baseball.json", "Baseball", "baseball/mlb", ["MLB"]),
    ("_basketball.json", "Basketball", "basketball/wnba", ["WNBA"]),
    ("_nfl.json", "NFL", "football/nfl", ["NFL"]),
]


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def _espn_day(sport_path: str, date_us: str):
    url = f"https://site.api.espn.com/apis/site/v2/sports/{sport_path}/scoreboard?dates={date_us}"
    try:
        raw = subprocess.run(
            ["curl", "-s", "-m", "30", url],
            capture_output=True, timeout=45).stdout
        return json.loads(raw)
    except Exception:
        return {}


def next_us_date(date_us: str) -> str:
    try:
        d = datetime.strptime(date_us, "%Y%m%d") + timedelta(days=1)
        return d.strftime("%Y%m%d")
    except Exception:
        return date_us


def _collect_finished(d, out):
    if not isinstance(d, dict):
        return
    for ev in d.get("events", []):
        for comp in ev.get("competitions", []):
            if comp.get("status", {}).get("type", {}).get("state") != "post":
                continue
            teams = comp.get("competitors", [])
            if len(teams) != 2:
                continue
            home = next((t for t in teams if t.get("homeAway") == "home"), None)
            away = next((t for t in teams if t.get("homeAway") == "away"), None)
            if not home or not away:
                continue
            hg, ag = str(home.get("score", "0")), str(away.get("score", "0"))
            if not (hg.isdigit() and ag.isdigit()):
                continue
            hn, an = norm(home["team"]["displayName"]), norm(away["team"]["displayName"])
            if hn and an:
                out[f"{hn}|{an}"] = f"{hg}-{ag}"


def espn_finished(slug: str, date_us: str):
    """Return {norm_home|norm_away: 'h-a'} for finished ESPN matches.

    slug = full ESPN sport path (e.g. 'soccer/eng.1', 'hockey/nhl').
    Also queries the next US date (late games / US-vs-WAT date offset).
    """
    out = {}
    for day in (date_us, next_us_date(date_us)):
        _collect_finished(_espn_day(slug, day), out)
    return out


def match_score(g: dict, finals: dict):
    """Find the final score for a daily game, tolerating name variants."""
    hn, an = norm(g["home"]), norm(g["away"])
    for key, score in finals.items():
        fh, fa = key.split("|")
        if (fh == hn or hn.startswith(fh) or fh.startswith(hn) or
                (len(hn) > 3 and (hn in fh or fh in hn))) and \
           (fa == an or an.startswith(fa) or fa.startswith(an) or
                (len(an) > 3 and (an in fa or fa in an))):
            return score
    return None


def parse_prob(prob):
    """'59/41' -> home probability 59 (int %), or None."""
    try:
        return int(str(prob).split("/")[0])
    except Exception:
        return None


def _rate(rows, k):
    v = [r[k] for r in rows if r.get(k) is not None]
    return round(100 * sum(v) / len(v), 1) if v else None


def score_soccer(datef, d, only, cache):
    """Score the main football board file. Returns (scored, day_rows)."""
    day = json.load(open(os.path.join(DAILY, datef)))
    if not isinstance(day, dict) or "games" not in day:
        return 0, []
    games = [g for g in day["games"] if g.get("covered") and g.get("model")]
    codes = sorted({g["league_code"] for g in games if g.get("league_code") in ESPN})
    date_us = datef[:-5].replace("-", "")
    finals = {}
    for c in codes:
        key = ("soccer/" + ESPN[c], date_us)
        if key not in cache:
            cache[key] = espn_finished("soccer/" + ESPN[c], date_us)
            print(f"  {datef[:-5]} {c}({ESPN[c]}): {len(cache[key])} finished")
        finals.update(cache[key])
    if not finals:
        return 0, []
    day_rows = []
    for g in games:
        s = match_score(g, finals)
        if not s:
            continue
        hg, ag = (int(x) for x in s.split("-"))
        full = "1" if hg > ag else ("X" if hg == ag else "2")
        total, btts = hg + ag, hg > 0 and ag > 0
        m = g["model"]
        pick_m = m.get("pick")
        pick_fb = g.get("fb_pick")
        day_rows.append(
            dict(
                match=f"{g['home']} v {g['away']}",
                league=g.get("league", ""),
                sport="Football",
                score=s,
                full=full,
                model_pick=pick_m,
                model_win=(1 if pick_m == full else 0) if pick_m else None,
                fb_pick=pick_fb if pick_fb in ("1", "X", "2") else None,
                fb_win=(1 if pick_fb == full else 0) if pick_fb in ("1", "X", "2") else None,
                over25=1 if total > 2 else 0,
                model_over25_win=(1 if (float(m.get("o25", 0)) >= 0.5) == (total > 2) else 0),
                model_btts=1 if float(m.get("btts", 0)) >= 0.5 else 0,
                btts_actual=1 if btts else 0,
                model_btts_win=(1 if (1 if float(m.get("btts", 0)) >= 0.5 else 0) == (1 if btts else 0) else 0),
                model_prob=None,
            )
        )
    return len(day_rows), day_rows


def score_other(datef, d, only, cache):
    """Score the non-soccer board files (moneyline). Returns (scored, day_rows)."""
    scored = 0
    all_rows = []
    for suffix, sport, path, leagues in OTHER_SPORTS:
        f = os.path.join(DAILY, d + suffix)
        if not os.path.exists(f):
            continue
        try:
            doc = json.load(open(f))
        except Exception:
            continue
        games = [g for g in doc.get("games", []) if g.get("pred") in ("1", "2")
                 and g.get("league") in leagues]
        if not games:
            continue
        date_us = d.replace("-", "")
        key = (path, date_us)
        if key not in cache:
            cache[key] = espn_finished(path, date_us)
            print(f"  {d} {sport}({path}): {len(cache[key])} finished")
        finals = cache[key]
        day_rows = []
        for g in games:
            s = match_score(g, finals)
            if not s:
                continue
            hg, ag = (int(x) for x in s.split("-"))
            full = "1" if hg > ag else ("X" if hg == ag else "2")
            day_rows.append(
                dict(
                    match=f"{g['home']} v {g['away']}",
                    league=g.get("league", ""),
                    sport=sport,
                    score=s,
                    full=full,
                    model_pick=g.get("pred"),
                    model_win=(1 if g.get("pred") == full else 0),
                    fb_pick=None, fb_win=None,
                    over25=None, model_over25_win=None,
                    model_btts=None, btts_actual=None, model_btts_win=None,
                    model_prob=parse_prob(g.get("prob")),
                )
            )
        scored += len(day_rows)
        all_rows.extend(day_rows)
    return scored, all_rows


def main():
    only = None
    if len(os.sys.argv) > 1:
        only = os.sys.argv[1]
    hist_path = os.path.join(RESULTS, "history.json")
    hist = json.load(open(hist_path)) if os.path.exists(hist_path) else {"days": {}, "cumulative": {}}
    cache = {}
    # dates = clean main files + any suffixed other-sport file
    suffixes = [x[0] for x in OTHER_SPORTS]
    dates = set()
    for fn in os.listdir(DAILY):
        if not fn.endswith(".json"):
            continue
        base = fn[:-5]
        matched = False
        for suf in suffixes:
            if base.endswith(suf):
                dates.add(base[:10])
                matched = True
                break
        if not matched and re.match(r"^\d{4}-\d{2}-\d{2}$", base):
            dates.add(base)
    for d in sorted(dates):
        if only and d != only:
            continue
        datef = d + ".json"
        n_soc, soc_rows = (score_soccer(datef, d, only, cache)
                           if os.path.exists(os.path.join(DAILY, datef)) else (0, []))
        n_oth, oth_rows = score_other(datef, d, only, cache)
        day_rows = soc_rows + oth_rows
        if day_rows:
            entry = hist["days"].setdefault(d, {"stats": {}, "rows": []})
            have = {r["match"] for r in entry["rows"]}
            entry["rows"].extend(r for r in day_rows if r["match"] not in have)
            entry["stats"] = dict(
                played=len(entry["rows"]),
                model_1x2=_rate(entry["rows"], "model_win"),
                fb_1x2=_rate(entry["rows"], "fb_win"),
                model_over25=_rate(entry["rows"], "model_over25_win"),
                model_btts=_rate(entry["rows"], "model_btts_win"),
            )
            print(f"{d}: scored {len(day_rows)} (soccer {n_soc}, other {n_oth})")
        else:
            print(f"{d}: no ESPN results found")
    allrows = [r for v in hist["days"].values() for r in v["rows"]]
    if allrows:
        hist["cumulative"] = dict(
            matches=len(allrows),
            days=len(hist["days"]),
            model_1x2=_rate(allrows, "model_win"),
            market_1x2=_rate(allrows, "market_win"),
            fb_1x2=_rate(allrows, "fb_win"),
            model_over25=_rate(allrows, "model_over25_win"),
            model_btts=_rate(allrows, "model_btts_win"),
        )
    os.makedirs(RESULTS, exist_ok=True)
    json.dump(hist, open(hist_path, "w"), indent=1)
    print("cumulative:", json.dumps(hist.get("cumulative", {})))


if __name__ == "__main__":
    main()
