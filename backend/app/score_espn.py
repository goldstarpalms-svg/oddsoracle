"""Score our picks against ESPN's official final scores (works when forebet
blocks us). ESPN's open scoreboard API is reachable from cloud IPs.

Covers the leagues in our daily model files:
  D1 ger.1  E0 eng.1  E1 eng.2  F1 fra.1  I1 ita.1  I2 ita.2
  NL1 ned.1  SC0 sco.1  SP1 esp.1  SP2 esp.2  TR1 tur.1

Run:  python3 score_espn.py            (all dated daily model files)
      python3 score_espn.py 2026-09-19 (one date)
"""
import io
import json
import os
import re
import subprocess

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


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def espn_finished(slug: str, date_us: str):
    """Return {norm_home|norm_away: 'h-a'} for finished ESPN matches."""
    url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/scoreboard?dates={date_us}"
    try:
        raw = subprocess.run(
            ["curl", "-s", "-m", "30", url],
            capture_output=True, timeout=45).stdout
        d = json.loads(raw)
    except Exception as e:
        print(f"  ! {slug} {date_us}: {e}")
        return {}
    out = {}
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


def _rate(rows, k):
    v = [r[k] for r in rows if r.get(k) is not None]
    return round(100 * sum(v) / len(v), 1) if v else None


def main():
    only = None
    if len(os.sys.argv) > 1:
        only = os.sys.argv[1]
    hist_path = os.path.join(RESULTS, "history.json")
    hist = json.load(open(hist_path)) if os.path.exists(hist_path) else {"days": {}, "cumulative": {}}
    cache = {}
    total = 0
    for datef in sorted(os.listdir(DAILY)):
        if not datef.endswith(".json") or "_" in datef[:-5]:
            continue
        d = datef[:-5]
        if only and d != only:
            continue
        day = json.load(open(os.path.join(DAILY, datef)))
        if not isinstance(day, dict) or "games" not in day:
            continue
        games = [g for g in day["games"] if g.get("covered") and g.get("model")]
        codes = sorted({g["league_code"] for g in games if g.get("league_code") in ESPN})
        date_us = d.replace("-", "")
        finals = {}
        for c in codes:
            key = (ESPN[c], date_us)
            if key not in cache:
                cache[key] = espn_finished(ESPN[c], date_us)
                print(f"  {d} {c}({ESPN[c]}): {len(cache[key])} finished")
            finals.update(cache[key])
        if not finals:
            print(f"{d}: no ESPN results found")
            continue
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
                )
            )
            total += 1
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
            print(f"{d}: scored {len(day_rows)}")
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
