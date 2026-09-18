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
    for i in range(1, len(parts)):
        h = " ".join(parts[:i])
        a = " ".join(parts[i:])
        if norm(names) == norm(h) + norm(a):
            return h, a
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

    try:
        rows = parse_rows(fetch(PAGES["football"]), "football")
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

    if summary:
        telegram_ticket(f" OddsOracle daily refresh ({today}): " + " | ".join(summary))
    print("done:", ", ".join(summary) if summary else "nothing updated (previous data kept)")


if __name__ == "__main__":
    main()
