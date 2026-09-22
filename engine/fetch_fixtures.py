"""
Fresh fixtures + prices, with NO API key and NO scraping of a protected site.

Source: https://www.football-data.co.uk/fixtures.csv
  - keyless, plain CSV, no Cloudflare
  - ~200 upcoming fixtures per refresh
  - 1X2 prices from bet365, Pinnacle, BetVictor, Betway, Betfair, SKB
  - over/under 2.5 prices too

Output: backend/app/daily/<DATE>_fixtures.json — one row per event with every
bookmaker's price, the de-vigged market probability, and the model's number.
Everything downstream (board, EV, arbs) reads this file.
"""
from __future__ import annotations

import csv
import datetime as dt
import re
import unicodedata
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from core import PoissonDC, canon, load_matches  # noqa: E402

FIXTURES_URL = "https://www.football-data.co.uk/fixtures.csv"
NEW_LEAGUE_URL = "https://www.football-data.co.uk/new_league_fixtures.csv"

# fixturedownload.com — keyless JSON feeds of REAL upcoming fixtures (no odds).
# This is what keeps the board current between odds refreshes.
# slug -> (display name, keys the historical CSVs use for that competition)
FEED_LEAGUES = {
    "epl-2026": ("Premier League", ["E0", "Premier League"]),
    "bundesliga-2026": ("Bundesliga", ["D1", "Bundesliga"]),
    "eredivisie-2026": ("Eredivisie", ["NL1", "Eredivisie"]),
    "championship-2026": ("Championship", ["E1", "Championship"]),
}
FEED_URL = "https://fixturedownload.com/feed/json/{slug}"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "daily")

# bookmaker columns present in fixtures.csv -> friendly names
BOOKS = {
    "B365": ("B365H", "B365D", "B365A"),
    "Pinnacle": ("PPH", "PPD", "PPA"),
    "BetVictor": ("BVH", "BVD", "BVA"),
    "Betway": ("BWH", "BWD", "BWA"),
    "Betfair": ("BFDH", "BFDD", "BFDA"),
    "SKB": ("SKBH", "SKBD", "SKBA"),
}

# Feed names are long-form ("1. FC Köln", "Bayer 04 Leverkusen"); the historical
# CSVs are short-form ("Köln", "Leverkusen"). Strip the noise, then fuzzy-match.
NOISE = re.compile(r"\b(fc|sc|sv|vfb|tsg|ssv|spvg|svw|vfl|vfr|borussia|bayer|eintracht|"
                   r"real|club|atletico|athletic|deportivo|ud|cd|sd|ac|as|us|ss|ssc|usl|"
                   r"\d{2}|\d{4}|e\.?v\.?|ii|iiii|u19|u21|u23|women|w)\b", re.I)


ALIAS = {
    "monchengladbach": "mgladbach", "munchen": "munich", "hamburger": "hamburg",
    "hamburgersv": "hamburg", "psv": "psv", "ajax": "ajax", "feyenoord": "feyenoord",
    "sporting": "sporting", "athletic": "athletic",
}


def strip_noise(name: str) -> str:
    # transliterate first: "Köln" must become "koln", not "k ln"
    txt = unicodedata.normalize("NFKD", str(name or ""))
    txt = txt.encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9 ]", " ", txt)
    s = NOISE.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    s = " ".join(ALIAS.get(tok, tok) for tok in s.split())
    return s


def map_team(name: str, candidates: list[str]):
    """Best historical team name for a feed name, or None."""
    if not candidates:
        return None
    key = strip_noise(name)
    if not key:
        return None
    exact = {strip_noise(c): c for c in candidates}
    if key in exact:
        return exact[key]
    try:
        from rapidfuzz import fuzz, process
        hit = process.extractOne(key, list(exact.keys()), scorer=fuzz.token_set_ratio, score_cutoff=72)
        if hit:
            return exact[hit[0]]
    except Exception:
        pass
    # token overlap fallback
    toks = set(key.split())
    best, best_score = None, 0.0
    for c in candidates:
        ct = set(strip_noise(c).split())
        if not ct:
            continue
        score = len(toks & ct) / max(1, min(len(toks), len(ct)))
        if score > best_score:
            best, best_score = c, score
    return best if best_score >= 0.6 else None


LEAGUE_NAMES = {
    "E0": "Premier League", "E1": "Championship", "E2": "League One", "E3": "League Two",
    "EC": "National League", "SP1": "La Liga", "SP2": "LaLiga 2", "I1": "Serie A",
    "I2": "Serie B", "D1": "Bundesliga", "D2": "2. Bundesliga", "F1": "Ligue 1",
    "F2": "Ligue 2", "N1": "Eredivisie", "P1": "Primeira Liga", "SC0": "Scottish Prem",
    "SC1": "Scottish Championship", "SC2": "Scottish League One", "SC3": "Scottish League Two",
    "B1": "Belgian Pro League", "G1": "Super League Greece", "T1": "Super Lig",
}


def fetch_csv(url: str = FIXTURES_URL) -> list[dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        text = r.read().decode("utf-8-sig", errors="ignore")
    return list(csv.DictReader(text.splitlines()))


def parse_date(s: str):
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return dt.datetime.strptime(s.strip(), fmt)
        except Exception:
            continue
    return None


def devig(odds: list[float]) -> list[float] | None:
    clean = [o for o in odds if o and o > 1]
    if len(clean) < 2:
        return None
    imp = [1 / o for o in clean]
    s = sum(imp)
    return [p / s for p in imp] if s > 0 else None


def best_prices(row: dict) -> dict:
    """Best available price per outcome, and every book's prices for arbs."""
    out = {"by_book": {}, "best": [None, None, None], "best_book": [None, None, None]}
    for name, (h, d, a) in BOOKS.items():
        try:
            trio = [float(row.get(h)), float(row.get(d)), float(row.get(a))]
        except (TypeError, ValueError):
            continue
        if not all(v and v > 1 for v in trio):
            continue
        out["by_book"][name] = trio
        for i, v in enumerate(trio):
            if out["best"][i] is None or v > out["best"][i]:
                out["best"][i] = v
                out["best_book"][i] = name
    return out


def fetch_feed(slug: str) -> list[dict]:
    try:
        req = urllib.request.Request(FEED_URL.format(slug=slug), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            return json.loads(r.read().decode("utf-8", errors="ignore"))
    except Exception as e:
        print(f"[feed] {slug} unavailable: {e}")
        return []


def parse_feed_date(s: str):
    for fmt in ("%Y-%m-%d %H:%M:%SZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            return dt.datetime.strptime(s.strip(), fmt)
        except Exception:
            continue
    return None


def price_index() -> dict:
    """(date, home, away) -> prices, from every football-data.co.uk fixture file."""
    idx = {}
    for url, cols in ((FIXTURES_URL, ("Div", "HomeTeam", "AwayTeam")),
                      (NEW_LEAGUE_URL, ("League", "Home", "Away"))):
        try:
            rows = fetch_csv(url)
        except Exception as e:
            print(f"[prices] {url} failed: {e}")
            continue
        for r in rows:
            d = parse_date(r.get("Date") or "")
            if not d:
                continue
            prices = best_prices(r)
            if prices["best"][0] is None:
                continue
            key = (d.strftime("%Y-%m-%d"), canon(r.get(cols[1])), canon(r.get(cols[2])))
            idx[key] = prices
    return idx


def build(date: str | None = None) -> dict:
    rows = fetch_csv()
    prices_by_key = price_index()
    print(f"[prices] indexed {len(prices_by_key)} priced fixtures")
    now = dt.datetime.utcnow()
    date = date or now.strftime("%Y-%m-%d")

    hist = load_matches()
    models = {}
    display: dict[str, dict[str, str]] = {}   # league -> {canon: prettiest original name}
    for lg, g in hist.groupby("league"):
        d: dict[str, str] = {}
        for _, r in g.iterrows():
            d.setdefault(r["home"], str(r["HomeTeam"]))
            d.setdefault(r["away"], str(r["AwayTeam"]))
        display[lg] = d
    for lg, g in hist.groupby("league"):
        if len(g) < 150:
            continue
        m = PoissonDC(sot_weight=0.35).fit(g)
        if m.att_ is not None:
            models[lg] = m

    events = []
    for r in rows:
        kick = parse_date(r.get("Date") or "")
        if not kick:
            continue
        prices = best_prices(r)
        if prices["best"][0] is None:
            continue
        dv = devig(prices["best"])
        if not dv:
            continue

        div = (r.get("Div") or "").strip()
        league = LEAGUE_NAMES.get(div, div)
        home, away = canon(r.get("HomeTeam")), canon(r.get("AwayTeam"))

        # the model is fitted per league key; historical files use either the
        # code or the display name, so try both
        m = models.get(div) or models.get(league)
        model = m.probs(home, away) if m else None
        model_p = list(model[:3]) if model else None

        events.append({
            "id": f"{div}-{kick.strftime('%Y%m%d')}-{home}-{away}",
            "league": league,
            "div": div,
            "home": r.get("HomeTeam"),
            "away": r.get("AwayTeam"),
            "kickoff": kick.strftime("%Y-%m-%dT%H:%M:%S") + "Z",
            "date": kick.strftime("%Y-%m-%d"),
            "time": (r.get("Time") or "").strip(),
            "kickoff_label": f"{kick.strftime('%a %d %b')} · {(r.get('Time') or '').strip()}",
            "finished": (now - kick).total_seconds() > 3 * 3600,
            "odds": {
                "best": [round(v, 4) if v else None for v in prices["best"]],
                "best_book": prices["best_book"],
                "by_book": {k: [round(x, 4) for x in v] for k, v in prices["by_book"].items()},
            },
            "market_prob": [round(x, 4) for x in dv],
            "model_prob": [round(x, 4) for x in model_p] if model_p else None,
            "model_version": "poisson-dc-sot-v2",
            "data_source": "football-data.co.uk fixtures.csv",
        })

    # ---- real upcoming fixtures from the keyless feed ---------------------
    seen = {e["id"] for e in events}
    for slug, (league_name, model_keys) in FEED_LEAGUES.items():
        for m in fetch_feed(slug):
            kick = parse_feed_date(m.get("DateUtc") or "")
            if not kick or (kick - now).total_seconds() < -3 * 3600:
                continue
            mdl = next((models[k] for k in model_keys if k in models), None)
            hcands = []
            if mdl:
                # team keys are space-free ("fckoln"); match against the display
                # name so both sides normalise the same way, then map back to the key
                disp = {}
                for k in model_keys:
                    disp.update(display.get(k, {}))
                hcands = [disp.get(t, t) for t in mdl.teams_.keys()]
            home_raw, away_raw = m.get("HomeTeam"), m.get("AwayTeam")
            home = canon(map_team(home_raw, hcands) or "") or canon(home_raw)
            away = canon(map_team(away_raw, hcands) or "") or canon(away_raw)
            if not home or not away:
                continue
            eid = f"{slug}-{kick.strftime('%Y%m%d')}-{home}-{away}"
            if eid in seen:
                continue
            seen.add(eid)
            prices = prices_by_key.get((kick.strftime("%Y-%m-%d"), home, away))
            if prices and prices["best"][0] is not None:
                dv = devig(prices["best"])
                odds_block = {
                    "best": [round(v, 4) if v else None for v in prices["best"]],
                    "best_book": prices["best_book"],
                    "by_book": {k: [round(x, 4) for x in v] for k, v in prices["by_book"].items()},
                }
            else:
                dv, odds_block = None, None
            mp = None
            if mdl:
                pr = mdl.probs(home, away)
                mp = [round(x, 4) for x in pr[:3]] if pr else None
            events.append({
                "id": eid,
                "league": league_name,
                "div": slug,
                "home": home_raw,
                "away": away_raw,
                "kickoff": kick.strftime("%Y-%m-%dT%H:%M:%S") + "Z",
                "date": kick.strftime("%Y-%m-%d"),
                "time": kick.strftime("%H:%M"),
                "kickoff_label": kick.strftime("%a %d %b · %H:%M"),
                "finished": False,
                "odds": odds_block,
                "market_prob": [round(x, 4) for x in dv] if dv else None,
                "model_prob": mp,
                "model_version": "poisson-dc-sot-v2",
                "data_source": "fixturedownload.com (fixtures) + football-data.co.uk (prices)",
            })

    events.sort(key=lambda e: e["kickoff"])
    upcoming = [e for e in events if not e["finished"]]

    doc = {
        "date": date,
        "generated_at": now.isoformat() + "Z",
        "source": "football-data.co.uk/fixtures.csv (keyless)",
        "count": len(events),
        "upcoming": len(upcoming),
        "latest_fixture_date": events[-1]["date"] if events else None,
        "events": events,
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{date}_fixtures.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    print(f"[fixtures] fetched {len(events)} events, {len(upcoming)} upcoming")
    print(f"[fixtures] latest fixture date in file: {doc['latest_fixture_date']}")
    print(f"[fixtures] wrote {path}")
    return doc


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else None)
