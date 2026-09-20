#!/usr/bin/env python3
"""
fetch_full_board_local.py — local (sandbox) fetcher for the FULL Forebet
per-date 1X2 board (every league, every game).

GitHub runners can reach Forebet directly (refresh_forebet.py does this in
the daily workflow). From this sandbox Cloudflare blocks Forebet, so this
script goes through the r.jina.ai reader proxy, which returns the real
page HTML (with hrefs rewritten to relative — restored here).

Parses two shapes:
  1. Full match rows (rcnt blocks): league tag, teams, WAT time, 1X2 % bar,
     prediction, predicted score, avg goals, live/FT score when present.
  2. "Top Trends" sidebar references: games that appear today but whose row
     the rendering did not expand — added with no pick (shown as "—" on site).

Output: daily/<date>_full_forebet.json — same row schema as
refresh_forebet.build_football, so the bundle merges it unchanged.
"""
import json
import os
import re
import sys
import time
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(BASE, "daily")

sys.path.insert(0, BASE)
from refresh_forebet import wat_time  # EDT(-4) display -> WAT(UTC+1)


def fetch_jina(url: str, tries: int = 4) -> str:
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(
                f"https://r.jina.ai/{url}",
                headers={
                    "X-Return-Format": "html",
                    "X-Timeout": "60",
                    "User-Agent": "Mozilla/5.0 (oddsoracle full-board fetch)",
                },
            )
            with urllib.request.urlopen(req, timeout=90) as r:
                html = r.read().decode("utf-8", "replace")
            if "Just a moment" in html[:2000] or len(html) < 20000:
                raise RuntimeError(f"challenge/short page ({len(html)} bytes)")
            return html.replace('href="/en/', 'href="https://www.forebet.com/en/')
        except Exception as e:
            last = e
            time.sleep(6 + i * 6)
    raise RuntimeError(f"jina fetch failed: {last}")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()


def parse_full(html: str, date: str):
    rows = {}
    order = []

    # ---- shape 1: full rcnt blocks -----------------------------------------
    for m in re.finditer(
        r'<div class="rcnt[^"]*">(.*?)(?=<div class="rcnt|$)', html, re.S
    ):
        blk = m.group(1)
        sm = re.search(r'getstag\(this,\s*\d+,\s*\'([^\']*)\',\s*\'([^\']*)\'', blk)
        league = sm.group(2).strip() if sm else ""
        tm = re.search(
            r'<span class="homeTeam"[^>]*>.*?itemprop="name">([^<]+)</span>'
            r'.*?<span class="awayTeam"[^>]*>.*?itemprop="name">([^<]+)</span>',
            blk, re.S,
        )
        if not tm:
            continue
        home, away = clean(tm.group(1)), clean(tm.group(2))
        dtm = re.search(r'<span class="date_bah">(\d{2}/\d{2}/\d{4} \d{1,2}:\d{2} [AP]M)</span>', blk)
        if not dtm:
            continue
        t, shift = wat_time(dtm.group(1))
        if not t or shift:
            continue  # not today in WAT
        pm = re.search(r'<div class="fprc">(.*?)</div>', blk, re.S)
        pct = None
        if pm:
            nums = [int(x) for x in re.findall(r">\s*(\d{1,3})\s*<", pm.group(1))]
            if len(nums) == 3 and 95 <= sum(nums) <= 105:
                pct = nums
        kpm = re.search(r'<span class="forepr">\s*<span>([12X])</span>', blk)
        pick = {"1": "1", "2": "X", "X": "X"}[kpm.group(1)] if kpm else ""
        scm = re.search(r'<span class="scrmobpred ex_sc">(.*?)</span></div>', blk, re.S)
        score = re.sub(r"\s+", "", clean(scm.group(1))) if scm else ""
        if not re.fullmatch(r"\d{1,2}-\d{1,2}", score or "x"):
            score = ""
        avgm = re.search(r'<div class="avg_sc tabonly">([\d.]+)</div>', blk)
        avg = avgm.group(1) if avgm else ""
        ftm = re.search(r'<b class="l_scr">(\d+)\s*[-–]\s*(\d+)</b>', blk)
        ft = f"{ftm.group(1)}-{ftm.group(2)}" if ftm else ""
        mid = re.search(r"/matches/[^/]+/[^/]+/(\d+)", blk)
        key = mid.group(1) if mid else f"{home}|{away}"
        if key in rows:
            continue
        rows[key] = dict(
            t=t, home=home, away=away, lg=league,
            fb_pct=pct, fb_score=score, avg=avg or None,
            odds=None, status="final" if ft else "", note="auto: full board (local fetch)",
            fb_pick=pick, mkt_dec=None, mkt_imp=None, mkt_pick=None,
            model=None, final=pick, src="FOREBET", ou="",
            final_score=ft or None, _id=key,
        )
        order.append(key)

    # ---- shape 2: Top Trends references ------------------------------------
    for m in re.finditer(
        r'<div class="ttr_cont">.*?href="(https://www\.forebet\.com/en/football/matches/[^"]+?-(\d+))"'
        r'>([^<]+)</a>\s*<span class="date_bah">(\d{2}/\d{2}/\d{4} \d{1,2}:\d{2} [AP]M)</span>',
        html, re.S,
    ):
        mid = m.group(2)
        if mid in rows:
            continue
        names = clean(m.group(3))
        if " - " not in names and " vs " not in names:
            continue
        names = names.replace(" vs ", " - ")
        home, away = [x.strip() for x in names.split(" - ", 1)]
        t, shift = wat_time(m.group(4))
        if not t or shift:
            continue
        rows[mid] = dict(
            t=t, home=home, away=away, lg="",
            fb_pct=None, fb_score="", avg=None,
            odds=None, status="", note="full board — no 1X2 pick published",
            fb_pick="", mkt_dec=None, mkt_imp=None, mkt_pick=None,
            model=None, final="", src="FOREBET", ou="",
            final_score=None, _id=mid,
        )
        order.append(mid)

    out = [rows[k] for k in order]
    out.sort(key=lambda r: (r["t"] or "99:99"))
    return out


def main():
    date = sys.argv[1] if len(sys.argv) > 1 else time.strftime("%Y-%m-%d")
    url = f"https://www.forebet.com/en/football-predictions/predictions-1x2/{date}"
    print(f"fetching full board {date} via jina proxy...")
    html = fetch_jina(url)
    rows = parse_full(html, date)
    p = os.path.join(DAILY, f"{date}_full_forebet.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    with_pct = sum(1 for r in rows if r["fb_pct"])
    with_pick = sum(1 for r in rows if r["fb_pick"])
    with_ft = sum(1 for r in rows if r.get("final_score"))
    leagues = len({r["lg"] for r in rows if r["lg"]})
    print(f"{p}: {len(rows)} games | {leagues} leagues | pct {with_pct} | pick {with_pick} | FT {with_ft}")


if __name__ == "__main__":
    main()
