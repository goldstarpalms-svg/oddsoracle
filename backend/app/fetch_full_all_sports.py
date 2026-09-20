#!/usr/bin/env python3
"""
fetch_full_all_sports.py — bring EVERY sport's Forebet daily board to full
coverage (basketball, tennis, hockey, baseball, handball), sandbox edition.

The tips-today pages ARE the full daily boards for these sports (verified:
basketball 49 games vs 8 in our file, tennis 45 vs 16). Cloudflare blocks the
sandbox, so pages come through the r.jina.ai reader proxy (X-Return-Format:
html; hrefs rewritten to relative — restored before parsing).

Time formats seen on Forebet (verified 20/9):
  * football  "09/20/2026 1:00 AM"  (MM/DD 12h, displayed EDT)  -> WAT = +5h
  * others    "20/09/2026 06:50"    (DD/MM 24h, displayed CET)  -> WAT = -1h
Rows are merged into the existing daily JSON files (deduped by match name),
keeping the exact row schemas the site already renders. Nothing is invented:
rows without a prediction keep prob only; rows that don't parse are skipped.
"""
import json
import os
import re
import sys
import time
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(BASE, "daily")
DATE = "2026-09-20"


def fetch_jina(url: str, tries: int = 6) -> str:
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(
                f"https://r.jina.ai/{url}",
                headers={"X-Return-Format": "html", "X-Timeout": "60",
                         "User-Agent": "Mozilla/5.0 (oddsoracle all-sports fetch)"},
            )
            with urllib.request.urlopen(req, timeout=90) as r:
                html = r.read().decode("utf-8", "replace")
            if "Just a moment" in html[:2000] or len(html) < 20000:
                raise RuntimeError(f"challenge/short ({len(html)} bytes)")
            return html.replace('href="/en/', 'href="https://www.forebet.com/en/')
        except Exception as e:
            last = e
            time.sleep(10 + i * 10)
    raise RuntimeError(f"jina fetch failed: {last}")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()


def wat_time_any(d: str):
    """'DD/MM/YYYY HH:MM' (CET) or 'MM/DD/YYYY h:MM AM/PM' (EDT) -> (HH:MM WAT, shift)."""
    from datetime import datetime, timedelta, timezone
    m12 = re.search(r"(\d{2})/(\d{2})/(\d{4}) (\d{1,2}):(\d{2}) ([AP]M)", d)
    if m12:
        mm, dd, yy, hh, mi, ap = m12.groups()
        hh = int(hh) % 12 + (12 if ap == "PM" else 0)
        t = datetime(int(yy), int(mm), int(dd), hh, int(mi), tzinfo=timezone.utc) + timedelta(hours=5)
        return t.strftime("%H:%M"), (1 if t.day != int(dd) else 0)
    m24 = re.search(r"(\d{2})/(\d{2})/(\d{4}) (\d{1,2}):(\d{2})$", d.strip())
    if m24:
        a, b, yy, hh, mi = m24.groups()
        dd, mm = (a, b) if int(a) > 12 else (b, a)  # day-first display
        t = datetime(int(yy), int(mm), int(dd), int(hh), int(mi), tzinfo=timezone.utc) - timedelta(hours=1)
        return t.strftime("%H:%M"), (1 if t.day != int(dd) else 0)
    return "", 0


def blocks(html: str):
    for m in re.finditer(r'<div class="rcnt[^"]*">(.*?)(?=<div class="rcnt|$)', html, re.S):
        yield m.group(1)


def parse_board(html: str):
    """Generic row extraction from forebet tips-today blocks."""
    rows = []
    for blk in blocks(html):
        sm = re.search(r'getstag\(this,\s*\'? (\d+) \'?\s*,\s*\'([^\']*)\',\s*\'([^\']*)\',\s*\'([^\']*)\'', blk)
        league = sm.group(3).strip() if sm and sm.group(3) else ""
        href_m = re.search(r'/matches/([^/]+)/', blk)
        if not league and href_m:
            _fix = {"nbl": "NBL", "nba": "NBA", "wnba": "WNBA", "tbl": "TBL", "fiba": "FIBA",
                    "kbl": "KBL", "bsl": "BSL", "vbl": "VBL", "lnl": "LNK", "gb": "GB",
                    "pro": "Pro", "liga": "Liga", "cup": "Cup", "league": "League"}
            league = " ".join(_fix.get(w, w.capitalize()) for w in href_m.group(1).split("-"))
        # teams
        tm = re.search(
            r'class="homeTeam"[^>]*>(?:<[^>]+>)?([^<]+?)<', blk)
        ta = re.search(
            r'class="awayTeam"[^>]*>(?:<[^>]+>)?([^<]+?)<', blk)
        if not tm or not ta:
            continue
        home, away = clean(tm.group(1)), clean(ta.group(1))
        dtm = re.search(r'class="date_bah">([^<]+)</span>', blk)
        if not dtm or not home or not away:
            continue
        t, shift = wat_time_any(dtm.group(1).strip())
        if not t or shift:
            continue
        pm = re.search(r'class="fprc[^"]*">(.*?)</div>', blk, re.S)
        probs = []
        if pm:
            probs = [int(x) for x in re.findall(r">\s*(\d{1,3})\s*<", pm.group(1))]
        pick = ""
        score = ""
        pm = re.search(r'class="predict(?:_no)?"[^>]*>(.*?)(?=<div class="ex_sc|<div class="avg_sc|<div class="bigOnly|<div class="schema_border|<div class="lmin_td|$)', blk, re.S)
        if pm:
            txt = clean(pm.group(1))
            mtk = re.search(r"\b([12X])\b", txt)
            if mtk:
                pick = mtk.group(1)
            msc = re.search(r"(\d{1,3})\s*[-–]\s*(\d{1,3})", txt)
            if msc:
                score = f"{msc.group(1)}-{msc.group(2)}"
        avgm = re.search(r'class="avg_sc tabonly">([\d.]+)<', blk)
        avg = avgm.group(1) if avgm else ""
        coefm = re.search(r"getHodd\(this,\s*\d+[^)]*\)\s*\">\s*([+-]?\d{2,4})\s*<", blk)
        coef = coefm.group(1) if coefm else ""
        # FINAL score only when the board marks it FT (in-play scores ignored)
        ft = ""
        slm = re.search(r'<div class="scoreLnk">(.*?)</div>', blk, re.S)
        if slm and re.search(r'>\s*FT\s*<', slm.group(1)):
            ftm = re.search(r'<b class="l_scr">(\d+)\s*[-–]\s*(\d+)</b>', blk)
            if ftm:
                ft = f"{ftm.group(1)}-{ftm.group(2)}"
        rows.append(dict(
            home=home, away=away, t=t,
            league=league or (slug.replace("-", " ").title() if slug else ""),
            probs=probs, pick=pick, score=score,
            avg=avg, coef=coef, ft=ft,
        ))
    return rows


def norm(s: str):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def merge_bb(path: str, rows: list):
    d = json.load(open(path, encoding="utf-8"))
    have = {norm(g.get("match", "")) for g in d.get("forebet_today_all", [])}
    added = 0
    for r in rows:
        key = norm(f"{r['home']} v {r['away']}")
        if key in have:
            continue
        p1, p2 = (r["probs"] + [0, 0])[:2]
        d.setdefault("forebet_today_all", []).append({
            "league": r["league"], "t": r["t"], "match": f"{r['home']} v {r['away']}",
            "home": r["home"], "away": r["away"],
            "prob": f"{p1}/{p2}" if p1 and p2 else "",
            "pred": r["pick"], "score": r["ft"] or r["score"], "avg": r["avg"] or None,
            "coef": r["coef"] or None, "status": "FT" if r["ft"] else "",
            "final": r["ft"] or None,
        })
        have.add(key)
        added += 1
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return added, len(d.get("forebet_today_all", []))


def merge_tn(path: str, rows: list):
    d = json.load(open(path, encoding="utf-8"))
    games = d.get("games", [])
    have = {norm(f"{g.get('p1','')}|{g.get('p2','')}") for g in games}
    added = 0
    for r in rows:
        key = norm(f"{r['home']}|{r['away']}")
        if key in have:
            continue
        p1, p2 = (r["probs"] + [0, 0])[:2]
        games.append({
            "tourn": r["league"], "t": r["t"], "p1": r["home"], "p2": r["away"],
            "prob": f"{p1}/{p2}" if p1 and p2 else "",
            "pred": r["pick"], "sets": r["score"], "coef": r["coef"] or None,
            "status": "FT" if r["ft"] else "", "final": r["ft"] or None,
        })
        have.add(key)
        added += 1
    d["games"] = games
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return added, len(games)


def merge_two_way(path: str, rows: list):
    d = json.load(open(path, encoding="utf-8"))
    games = d.get("games", [])
    have = {norm(f"{g.get('home','')}|{g.get('away','')}") for g in games}
    added = 0
    for r in rows:
        key = norm(f"{r['home']}|{r['away']}")
        if key in have:
            continue
        p1, p2 = (r["probs"] + [0, 0])[:2]
        games.append({
            "match": f"{r['home']} v {r['away']}", "home": r["home"], "away": r["away"],
            "league": r["league"], "t": r["t"],
            "prob": f"{p1}/{p2}" if p1 and p2 else "",
            "pred": r["pick"], "score": r["score"],
            "coef": r["coef"] or None, "avg": r["avg"] or None,
            "status": "FT" if r["ft"] else "",
        })
        have.add(key)
        added += 1
    d["games"] = games
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return added, len(games)


SPORTS = {
    "basketball": ("https://www.forebet.com/en/basketball/predictions-today", f"{DATE}_basketball.json", merge_bb),
    "tennis": ("https://www.forebet.com/en/tennis/predictions-today", f"{DATE}_tennis.json", merge_tn),
    "hockey": ("https://www.forebet.com/en/hockey/predictions-today", f"{DATE}_hockey.json", merge_two_way),
    "baseball": ("https://www.forebet.com/en/baseball/predictions-today", f"{DATE}_baseball.json", merge_two_way),
    "handball": ("https://www.forebet.com/en/handball/predictions-today", f"{DATE}_handball.json", merge_two_way),
}


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for sport, (url, fname, merge) in SPORTS.items():
        if only and sport != only:
            continue
        path = os.path.join(DAILY, fname)
        if not os.path.exists(path):
            print(f"{sport}: no local file {fname} — skipped")
            continue
        try:
            html = fetch_jina(url)
        except Exception as e:
            print(f"{sport}: fetch failed ({e})")
            continue
        rows = parse_board(html)
        added, total = merge(path, rows)
        print(f"{sport}: parsed {len(rows)} rows -> +{added} new, {total} in file")


if __name__ == "__main__":
    main()
