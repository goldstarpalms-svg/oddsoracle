"""Daily Forebet refresher for the OddsOracle site.

Fetches forebet's "predictions today" pages for football, basketball and
tennis, parses the pick tables, converts kickoff times to WAT (UTC+1, Lagos),
and writes the daily JSON files the Next.js site reads (same schema as the
manually curated files):

  backend/app/daily/<date>_forebet_football.json  (fallback football feed)
  backend/app/daily/<date>_basketball.json
  backend/app/daily/<date>_tennis.json

Notes:
  * Forebet displays kickoff times in US Eastern (EDT). WAT = displayed + 5h.
  * If a page fails to parse (layout change / IP block), that sport is
    SKIPPED and the previous file is left untouched — the site keeps showing
    the last good data.
  * Optional Telegram morning ticket: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.

Run:  python3 backend/app/refresh_forebet.py
"""
import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
WAT = timezone(timedelta(hours=1))
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}

PAGES = {
    "football": "https://www.forebet.com/en/football-tips-and-predictions-for-today",
    "basketball": "https://www.forebet.com/en/basketball/predictions-today",
    "tennis": "https://www.forebet.com/en/tennis/predictions-today",
}


def fetch(url: str) -> str:
    r = requests.get(url, headers=UA, timeout=45)
    r.raise_for_status()
    return r.text


def strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def wat_time(edt_str: str):
    """'09/18/2026 11:00 AM' (EDT) -> ('16:00', day_shift_0_or_1) WAT."""
    m = re.search(r"(\d{2})/(\d{2})/(\d{4}) (\d{1,2}):(\d{2}) ([AP]M)", edt_str)
    if not m:
        return "", 0
    mm, dd, yy, hh, mi, ap = m.groups()
    hh = int(hh) % 12 + (12 if ap == "PM" else 0)
    t = (
        datetime(int(yy), int(mm), int(dd), hh, int(mi), tzinfo=timezone.utc)
        + timedelta(hours=1)  # EDT(-4) -> UTC -> WAT(+1) = +5
    )
    return t.strftime("%H:%M"), (1 if t.day != int(dd) else 0)


def split_names(names: str, slug: str):
    """Split concatenated 'HomeAway' using the URL slug as a guide."""
    parts = slug.split("-")
    best = None
    for i in range(1, len(parts)):
        h = " ".join(parts[:i])
        a = " ".join(parts[i:])
        if norm(names) == norm(h) + norm(a):
            best = (h, a)  # keep updating: the LONGEST home-side split wins
    if best:
        return best
    # fuzzy: allow minor character differences (W suffixes, accents...)
    nn = norm(names)
    best = None
    for i in range(1, len(parts)):
        h = " ".join(parts[:i])
        a = " ".join(parts[i:])
        nh, na = norm(h), norm(a)
        if nh and na and nn.endswith(na) and nn.startswith(nh[: max(3, len(nh) - 2)]):
            if best is None or len(h) > len(best[0]):
                best = (h, a)
    if best:
        return best
    return names, ""


def parse_rows(html: str, sport: str):
    out = []
    for tr in re.findall(r"<tr[^>]*>.*?</tr>", html, re.S):
        m = re.search(
            r'href="https://www\.forebet\.com/en/' + sport + r'/matches/([^/"]+)/([^/"]+)/(\d+)"',
            tr,
        )
        if not m:
            continue
        league_slug, match_slug, _mid = m.groups()
        cells = [strip_tags(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        anchor = next((c for c in cells if re.search(r"\d{2}/\d{2}/\d{4}", c)), "")
        if not anchor:
            continue
        t, shift = wat_time(anchor)
        if not t:
            continue
        m2 = re.match(r"^(.+?)\d{2}/\d{2}/\d{4}", anchor)
        names = m2.group(1).strip() if m2 else anchor
        home, away = split_names(names, match_slug)
        out.append(
            dict(
                league=league_slug.replace("-", " ").title(),
                t=t + ("+" if shift else ""),
                shift=shift,
                home=home,
                away=away,
                cells=cells,
                url=f"https://www.forebet.com/en/{sport}/matches/{league_slug}/{match_slug}/{_mid}",
            )
        )
    return out


def ints_after(cells, n):
    vals = []
    for c in cells[1:]:
        if re.fullmatch(r"[+-]?\d+", c):
            vals.append(int(c))
        if len(vals) >= n:
            break
    return vals


def first_match(cells, pattern):
    for c in cells:
        if re.fullmatch(pattern, c):
            return c
    return ""


def build_football(rows):
    out = []
    for r in rows:
        n = ints_after(r["cells"], 4)
        if len(n) < 4:
            continue
        p1, px, p2, pred = n
        if max(p1, px, p2) < 35 or (p1 + px + p2) < 95:
            continue
        pick = {1: "1", 2: "X", 3: "2"}.get(pred, "")
        if not pick:  # some tables use 1/2 for 1/2 with X folded into odds col
            pick = "1" if pred == 1 else "2"
        score = first_match(r["cells"], r"\d{1,2}-\d{1,2}")
        avg = ""
        for c in r["cells"]:
            if re.fullmatch(r"\d{2,3}(\.\d)?", c) and c != score:
                avg = c
        out.append(
            dict(
                t=r["t"], home=r["home"], away=r["away"], lg=r["league"],
                fb_pct=[p1, px, p2], fb_score=score, avg=avg or None,
                odds=None, status="", note="auto-refresh from Forebet",
                fb_pick=pick, mkt_dec=None, mkt_imp=None, mkt_pick=None,
                model=None, final=pick, src="FOREBET", ou="",
            )
        )
    return out


def build_basketball(rows):
    games, all_rows = [], []
    for r in rows:
        n = ints_after(r["cells"], 3)
        if len(n) < 3:
            continue
        p1, p2, pred = n
        if p1 + p2 < 80:
            continue
        score = first_match(r["cells"], r"\d{2,3}-\d{2,3}")
        avg = ""
        for c in r["cells"]:
            if re.fullmatch(r"\d{2,3}\.\d", c):
                avg = c
        row = dict(
            league=r["league"], t=r["t"],
            match=f"{r['home']} v {r['away']}",
            prob=f"{p1}/{p2}", pred=str(pred), score=score, avg=avg,
            coef="".join(
                c for c in r["cells"] if re.fullmatch(r"[+-]\d{3,4}", c)
            ),
        )
        all_rows.append(row)
        if max(p1, p2) >= 60 and r["home"] and r["away"]:
            games.append(
                dict(
                    league=r["league"], t=r["t"],
                    home=r["home"], away=r["away"],
                    fb_prob=[p1, p2],
                    fb_pick=f"{pred} ({r['home'] if pred == '1' else r['away']})",
                    fb_score=score, fb_avg=avg or None, fb_coef=row["coef"] or "none",
                    pick=f"{pred} ({r['home'] if pred == '1' else r['away']}) — Forebet",
                    conf="MEDIUM (Forebet auto-feed)",
                    total=f"avg {avg}" if avg else "",
                    why="Auto-refreshed from the Forebet daily feed.",
                )
            )
    return games, all_rows


def build_tennis(rows):
    games = []
    for r in rows:
        n = ints_after(r["cells"], 3)
        if len(n) < 3:
            continue
        p1, p2, pred = n
        if p1 + p2 < 80:
            continue
        sets = first_match(r["cells"], r"\d-\d")
        coefs = [c for c in r["cells"] if re.fullmatch(r"[+-]\d{3,4}", c)]
        games.append(
            dict(
                tourn=r["league"], t=r["t"],
                p1=r["home"], p2=r["away"],
                prob=f"{p1}/{p2}",
                pred=f"{pred} ({r['home'] if pred == '1' else r['away']})" if r["home"] else str(pred),
                sets=sets, coef="/".join(coefs[:2]) or "n/a",
                note="auto-refresh from Forebet daily feed",
            )
        )
    return games


# ---------- forebet's EXTRA market boards (HT, HT/FT, corners, cards, goalscorers) ----------
# Same table layout as the main board; tolerant per-market parsers. Output:
#   <date>_fb_extra.json  { "date": ..., "games": { "Home|Away": {"ht": ..., "htft": ...,
#                                                       "corners": ..., "cards": ..., "scorers": ...} } }
EXTRA_PAGES = {
    "ht": "https://www.forebet.com/en/football-tips-and-predictions-for-today/predictions-ht",
    "htft": "https://www.forebet.com/en/football-tips-and-predictions-for-today/predictions-ht-ft",
    "corners": "https://www.forebet.com/en/football-tips-and-predictions-for-today/corners",
    "cards": "https://www.forebet.com/en/football-tips-and-predictions-for-today/cards",
    "scorers": "https://www.forebet.com/en/football-tips-and-predictions-for-today/predictions-goalscorers",
}


def build_extra(rows, market):
    out = {}
    for r in rows:
        if not r["home"] or not r["away"]:
            continue
        cells = r["cells"]
        key = f"{r['home']}|{r['away']}"
        d = {}
        if market == "ht":
            n = ints_after(cells, 4)
            if len(n) >= 4:
                p1, px, p2, pred = n
                pick = {1: "1", 2: "X", 3: "2"}.get(pred, str(pred))
                score = first_match(cells, r"\d{1,2}-\d{1,2}")
                d["ht"] = f"1 {p1}% / X {px}% / 2 {p2}%, call {pick}" + (f", score {score}" if score else "")
        elif market == "htft":
            combo = first_match(cells, r"^[1X2]/[1X2]$")
            nums = [int(c) for c in cells[1:] if re.fullmatch(r"\d{1,3}", c)]
            if combo:
                d["htft"] = f"{combo} {nums[0]}%" if nums else combo
        elif market in ("corners", "cards"):
            score = first_match(cells, r"\d{1,2}-\d{1,2}")
            nums = [int(c) for c in cells[1:] if re.fullmatch(r"\d{1,3}", c)]
            if len(nums) >= 2:
                over, under = nums[0], nums[1]
                d[market] = f"{'Over' if over >= under else 'Under'} ({over}/{under})" + (f", score {score}" if score else "")
            elif score:
                d[market] = f"score {score}"
        elif market == "scorers":
            names = []
            skip = {norm(r["home"]), norm(r["away"])}
            for c in cells:
                if re.fullmatch(r"[A-Z][A-Za-zÀ-ÿ'.-]+ [A-Z][A-Za-zÀ-ÿ'.-]+", c):
                    nc = norm(c)
                    if nc in skip or any(nc == norm(x) for x in names):
                        continue
                    names.append(c)
            if names:
                d["scorers"] = ", ".join(names[:3])
        if d:
            out[key] = d
    return out


# ---------- H2H (head-to-head) + form + stats from forebet game pages ----------
# Learned from forebet's game-page layout: a "Head to head" table of past
# meetings (date | score | teams), market-stat rows (Over 2.5, BTTS, ...),
# and per-team recent form (5-char W/D/L strings). Parsers are deliberately
# tolerant: any missing section just stays empty.

def parse_match_page(html: str):
    out = {"h2h": [], "stats": {}, "form": {}}
    m = re.search(r"head\s*to\s*head", html, re.I)
    if m:
        seg = html[m.start():m.start() + 15000]
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", seg, re.S):
            cells = [strip_tags(c).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
            if len(cells) < 3:
                continue
            date = next((c for c in cells if re.fullmatch(r"\d{2}/\d{2}/\d{4}", c)), None)
            score = next((c for c in cells if re.fullmatch(r"\d{1,3}\s*-\s*\d{1,3}", c.replace(" ", "")) and ":" not in c), None)
            if not date or not score:
                continue
            # team names: last name-cell before the score = past home, first after = past away
            si = next((i for i, c in enumerate(cells) if c.replace(" ", "") == score.replace(" ", "")), None)
            home_n = away_n = ""
            if si is not None:
                for j in range(si - 1, -1, -1):
                    if re.search(r"[A-Za-zÀ-ÿ]{3,}", cells[j]) and not re.search(r"\d{2}/\d{2}/\d{4}", cells[j]):
                        home_n = cells[j]
                        break
                for j in range(si + 1, len(cells)):
                    if re.search(r"[A-Za-zÀ-ÿ]{3,}", cells[j]) and not re.search(r"\d{2}/\d{2}/\d{4}", cells[j]):
                        away_n = cells[j]
                        break
            out["h2h"].append([date, score.replace(" ", ""), home_n, away_n])
    for label, key in (("over 2.5", "over25"), ("both teams to score", "btts"), ("clean sheet", "clean"), ("goals", "goals")):
        mm = re.search(r"<tr[^>]*>(?:(?!</tr>).)*?" + re.escape(label) + r"(?:(?!</tr>).)*?</tr>", html, re.I | re.S)
        if mm:
            cells = [strip_tags(c).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", mm.group(0), re.S)]
            nums = [c for c in cells if re.fullmatch(r"[\d.]+|\d+/\d+", c)]
            if len(nums) >= 2:
                out["stats"][key] = [nums[0], nums[1]]
    seen = []
    for c in re.findall(r"<t[dh][^>]*>\s*([WDLR]{5})\s*</t[dh]>", html):
        if c not in seen:
            seen.append(c)
        if len(seen) == 2:
            break
    if len(seen) == 2:
        out["form"] = {"home": seen[0], "away": seen[1]}
    return out


def fetch_h2h(jobs, max_games=150):
    """jobs: [(sport, row)] with row["url"]. Returns ({'home|away': data}, [sample_raw_pages])."""
    games = {}
    sample = []
    n = 0
    for _sport, r in jobs:
        url = r.get("url")
        if not url:
            continue
        if n >= max_games:
            break
        n += 1
        key = f"{r['home']}|{r['away']}"
        try:
            html = fetch(url)
            if len(sample) < 2:
                sample.append({"url": url, "text": re.sub(r"<script.*?</script>", "", html, flags=re.S)[:80000]})
            data = parse_match_page(html)
            if data["h2h"] or data["stats"] or data["form"]:
                games[key] = data
        except Exception:
            pass
        time.sleep(1.2)
    return games, sample


# ---------- results from forebet's "yesterday" board (final scores) ----------
YESTERDAY = "https://www.forebet.com/en/football-tips-and-predictions-for-yesterday"


def parse_result_rows(html: str):
    """Yesterday board: same row layout but no kickoff time needed.
    Score = LAST score-like cell (predicted score comes before final score)."""
    out = []
    for tr in re.findall(r"<tr[^>]*>.*?</tr>", html, re.S):
        m = re.search(r'href="https://www\.forebet\.com/en/football/matches/([^/"]+)/([^/"]+)/(\d+)"', tr)
        if not m:
            continue
        _lg, match_slug, _mid = m.groups()
        cells = [strip_tags(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if not any(re.search(r"\d{2}/\d{2}/\d{4}", c) for c in cells):
            continue
        scores = [c.strip() for c in cells if re.fullmatch(r"\d{1,2}\s*-\s*\d{1,2}", c.strip())]
        if not scores:
            continue
        # names sit in the anchor cell, BEFORE the date (same layout as parse_rows)
        anchor = next((c for c in cells if re.search(r"\d{2}/\d{2}/\d{4}", c)), "")
        m2 = re.match(r"^(.+?)\d{2}/\d{2}/\d{4}", anchor)
        names = m2.group(1).strip() if m2 else ""
        home, away = split_names(names, match_slug)
        out.append(dict(home=home, away=away, score=scores[-1].replace(" ", "")))
    return out


def _rate(rows, k):
    v = [r[k] for r in rows if r.get(k) is not None]
    return round(100 * sum(v) / len(v), 1) if v else None


def score_with_forebet():
    """Score our picks against forebet's final scores from yesterday's board.
    Merges into results/history.json (keeps any football-data rows)."""
    try:
        rows = parse_result_rows(fetch(YESTERDAY))
    except Exception as e:
        print(f"yesterday board: SKIPPED ({e})")
        return
    finals = {}
    for r in rows:
        if r["home"] and r["away"] and r["score"]:
            finals[norm(r["home"]) + "|" + norm(r["away"])] = r["score"]
    if not finals:
        print("yesterday board: no final scores parsed")
        return
    res_dir = os.path.join(HERE, "results")
    hist_path = os.path.join(res_dir, "history.json")
    hist = json.load(open(hist_path)) if os.path.exists(hist_path) else {"days": {}, "cumulative": {}}
    scored = 0
    for datef in sorted(os.listdir(DAILY)):
        if not datef.endswith(".json") or "_" in datef[:-5]:
            continue
        day = json.load(open(os.path.join(DAILY, datef)))
        games = day["games"] if isinstance(day, dict) and "games" in day else (day if isinstance(day, list) else [])
        day_rows = []
        for g in games:
            if not isinstance(g, dict) or not g.get("home") or not g.get("away"):
                continue
            k = norm(g["home"]) + "|" + norm(g["away"])
            if k not in finals:
                continue
            parts = finals[k].split("-")
            if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
                continue
            hg, ag = int(parts[0]), int(parts[1])
            full = "1" if hg > ag else ("X" if hg == ag else "2")
            total, btts = hg + ag, hg > 0 and ag > 0
            model = g.get("model") or {}
            pick_m = model.get("pick")
            pick_fb = g.get("fb_pick") or g.get("final")
            day_rows.append(
                dict(
                    match=f"{g['home']} v {g['away']}",
                    league=g.get("league", ""),
                    score=f"{hg}-{ag}",
                    full=full,
                    model_pick=pick_m,
                    model_win=(1 if pick_m == full else 0) if pick_m else None,
                    fb_pick=pick_fb,
                    fb_win=(1 if pick_fb == full else 0) if pick_fb else None,
                    over25=1 if total > 2 else 0,
                    model_over25_win=(1 if (model.get("o25", 0) >= 0.5) == (total > 2) else 0) if model else None,
                    model_btts=1 if model.get("btts", 0) >= 0.5 else 0,
                    btts_actual=1 if btts else 0,
                    model_btts_win=(1 if (1 if model.get("btts", 0) >= 0.5 else 0) == (1 if btts else 0) else 0) if model else None,
                )
            )
            scored += 1
        if day_rows:
            d = datef[:-5]
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
    os.makedirs(res_dir, exist_ok=True)
    json.dump(hist, open(hist_path, "w"), indent=1)
    print(f"results: {scored} games scored from forebet yesterday board -> {hist.get('cumulative', {})}")


def telegram_ticket(text: str):
    tok = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat = os.environ.get("TELEGRAM_CHAT_ID")
    if not (tok and chat):
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{tok}/sendMessage",
            json={"chat_id": chat, "text": text, "parse_mode": "HTML"},
            timeout=30,
        )
        print("telegram: ticket sent")
    except Exception as e:
        print(f"telegram: {e}")


def write_if_better(path, payload, min_rows, key=None):
    data = payload if key is None else payload.get(key, [])
    if len(data) < min_rows:
        return False
    with open(path, "w") as f:
        json.dump(payload, f, indent=1)
    return True


def main():
    today = datetime.now(WAT).strftime("%Y-%m-%d")
    summary = []
    board_rows = {}

    try:
        rows = parse_rows(fetch(PAGES["football"]), "football")
        board_rows["football"] = rows
        data = build_football(rows)
        p = os.path.join(DAILY, f"{today}_forebet_football.json")
        if write_if_better(p, data, 20):
            summary.append(f"football: {len(data)} picks")
            print(f"football: {len(data)} picks -> {p}")
        else:
            print(f"football: SKIPPED ({len(data)} rows parsed)")
    except Exception as e:
        print(f"football: SKIPPED ({e})")

    try:
        rows = parse_rows(fetch(PAGES["basketball"]), "basketball")
        board_rows["basketball"] = rows
        games, all_rows = build_basketball(rows)
        payload = {
            "date": today,
            "source": "Forebet daily feed (auto-refresh)",
            "games": games,
            "forebet_today_all": all_rows,
        }
        p = os.path.join(DAILY, f"{today}_basketball.json")
        if write_if_better(p, payload, 5, key="forebet_today_all"):
            summary.append(f"basketball: {len(all_rows)} picks")
            print(f"basketball: {len(all_rows)} picks -> {p}")
        else:
            print(f"basketball: SKIPPED ({len(all_rows)} rows parsed)")
    except Exception as e:
        print(f"basketball: SKIPPED ({e})")

    try:
        rows = parse_rows(fetch(PAGES["tennis"]), "tennis")
        board_rows["tennis"] = rows
        games = build_tennis(rows)
        payload = {"date": today, "source": "Forebet daily feed (auto-refresh)", "games": games}
        p = os.path.join(DAILY, f"{today}_tennis.json")
        if write_if_better(p, payload, 5, key="games"):
            summary.append(f"tennis: {len(games)} picks")
            print(f"tennis: {len(games)} picks -> {p}")
        else:
            print(f"tennis: SKIPPED ({len(games)} rows parsed)")
    except Exception as e:
        print(f"tennis: SKIPPED ({e})")

    # --- forebet's extra markets: HT / HT-FT / corners / cards / goalscorers ---
    try:
        extra = {}
        for mkt, url in EXTRA_PAGES.items():
            try:
                part = build_extra(parse_rows(fetch(url), "football"), mkt)
                for k, v in part.items():
                    extra.setdefault(k, {}).update(v)
                print(f"extra[{mkt}]: {len(part)} rows")
                time.sleep(1.2)
            except Exception as e:
                print(f"extra[{mkt}]: SKIPPED ({e})")
        if extra:
            p = os.path.join(DAILY, f"{today}_fb_extra.json")
            json.dump({"date": today, "games": extra}, open(p, "w"), indent=1)
            summary.append(f"extra markets: {len(extra)} games")
    except Exception as e:
        print(f"extra markets: SKIPPED ({e})")

    # --- H2H + stats + form for today's games (forebet game pages) ---
    try:
        jobs = [(s, r) for s, rs in board_rows.items() for r in rs if r.get("url")]
        h2h_games, sample = fetch_h2h(jobs)
        if h2h_games:
            p = os.path.join(DAILY, f"{today}_h2h.json")
            json.dump({"date": today, "games": h2h_games}, open(p, "w"), indent=1)
            summary.append(f"h2h: {len(h2h_games)} games")
            print(f"h2h: {len(h2h_games)} games -> {p}")
        else:
            print("h2h: nothing parsed (layout check needed — see _h2h_sample.json)")
        if sample:
            json.dump(sample, open(os.path.join(DAILY, "_h2h_sample.json"), "w"), indent=1)
            print(f"h2h sample pages saved ({len(sample)})")
    except Exception as e:
        print(f"h2h: SKIPPED ({e})")

    # --- results: score picks against forebet's final scores (yesterday board) ---
    try:
        score_with_forebet()
    except Exception as e:
        print(f"results: SKIPPED ({e})")

    if summary:
        telegram_ticket(f" OddsOracle daily refresh ({today}): " + " | ".join(summary))
    print("done:", ", ".join(summary) if summary else "nothing updated (previous data kept)")


if __name__ == "__main__":
    main()
