#!/usr/bin/env python3
"""
fetch_setka.py — TABLE TENNIS (Setka Cup) board for ODDSORACLE.

Sources:
  * History:   data/setka_history.csv (155k+ matches, June 2025 -> latest export)
  * Elo:       data/setka_leaderboard.csv
  * Live/today: official Setka Cup API (https://tabletennis.setkacup.com/api) — keyless

Model: faithful port of sekta-cup first_set_intelligence / setka_core.predict_match
  * player win probability: logit(elo) + form + H2H + point/set dominance (calibrated x0.94)
  * expected first-set points: weighted mean (global, player career, recent, H2H)
    + closeness bonus; normal-distribution over probability blended 55/45 with
    empirical over rates.
  * player type: fast over starter / under starter / neutral starter (+ volatility)

Output: daily/<date>_setka.json  {date, fetched_at, history, games:[...]}
Run:   python3 backend/app/fetch_setka.py [YYYY-MM-DD]
Stdlib only (no pandas) so it runs in the daily workflow as-is.
"""
import csv
import json
import math
import os
import re
import statistics
import time
import unicodedata
import urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
DATA = os.path.join(HERE, "data")
HIST_CSV = os.path.join(DATA, "setka_history.csv")
ELO_CSV = os.path.join(DATA, "setka_leaderboard.csv")
SETKA_API = "https://tabletennis.setkacup.com/api"
UA = {"User-Agent": "OddsOracle/1.0 (setka-cup intelligence)"}

RECENT_N = 20
H2H_RECENT = 12
MIN_MATCHES = 5


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-x))


def logit(p):
    p = clamp(p, 1e-4, 1 - 1e-4)
    return math.log(p / (1 - p))


def normal_over_prob(mean, line, std):
    std = max(float(std), 0.1)
    z = (line - mean) / std
    return clamp(0.5 * math.erfc(z / math.sqrt(2)), 0.02, 0.98)


def weighted_mean(pairs, default):
    num = den = 0.0
    for v, w in pairs:
        if v is None or w <= 0:
            continue
        num += float(v) * float(w)
        den += float(w)
    return num / den if den else float(default)


def reliability(n, full_at=80):
    if not n:
        return 0.0
    return clamp(float(n) / full_at, 0.0, 1.0)


def parse_set_scores(text):
    """'3-11;8-11;11-8' -> [(3,11),(8,11),(11,8)]"""
    out = []
    if not text:
        return out
    for part in text.replace(",", ";").split(";"):
        m = re.match(r"\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$", part)
        if m:
            out.append((int(m.group(1)), int(m.group(2))))
    return out


def load_history():
    """One pass over 155k rows -> per-player logs, pair index, global stats."""
    players = defaultdict(list)  # name -> list of per-player match dicts (chronological)
    pairs = defaultdict(list)    # frozenset(a,b) -> list of match dicts (chronological)
    g_first, g_total, g_sets = [], [], []
    g_first_over = g_total_over = 0
    n = 0
    with open(HIST_CSV, newline="") as f:
        for row in csv.DictReader(f):
            sets = parse_set_scores(row.get("set_scores", ""))
            if not sets or not row.get("winner"):
                continue
            fs = sets[0]
            first_total = sum(fs)
            total = sum(sum(s) for s in sets)
            p1, p2 = row["player1"].strip(), row["player2"].strip()
            if not p1 or not p2 or p1 == p2:
                continue
            dt = (row.get("date", ""), row.get("time", ""))
            rec = {
                "dt": dt,
                "p1": p1,
                "p2": p2,
                "winner": row["winner"].strip(),
                "first": first_total,
                "total": total,
                "sets": len(sets),
                "fs_p1": fs[0],
                "fs_p2": fs[1],
            }
            n += 1
            g_first.append(first_total)
            g_total.append(total)
            g_sets.append(len(sets))
            g_first_over += 1 if first_total > 18.5 else 0
            g_total_over += 1 if total > 75.5 else 0
            pairs[frozenset((p1, p2))].append(rec)
            for name, pts, fs_pts, won_fs, won in (
                (p1, sum(s[0] for s in sets), fs[0], fs[0] > fs[1], row["winner"].strip() == p1),
                (p2, sum(s[1] for s in sets), fs[1], fs[1] > fs[0], row["winner"].strip() == p2),
            ):
                players[name].append({
                    "dt": dt,
                    "won": won,
                    "points_for": pts,
                    "points_against": total - pts,
                    "first": first_total,
                    "first_for": fs_pts,
                    "first_won": won_fs,
                    "sets_won": sum(1 for s in sets if max(s) == pts and (pts == s[0] or pts == s[1]) and s[0] != s[1]) if name == p1 else 0,
                    "total": total,
                    "nsets": len(sets),
                })
    for rows in players.values():
        rows.sort(key=lambda r: r["dt"])
    for rows in pairs.values():
        rows.sort(key=lambda r: r["dt"])
    global_stats = {
        "first_set_mean": statistics.fmean(g_first) if g_first else 18.7,
        "first_set_std": statistics.stdev(g_first) if len(g_first) > 1 else 3.2,
        "first_set_over_18_5_rate": (g_first_over / len(g_first)) if g_first else 0.5,
        "total_points_mean": statistics.fmean(g_total) if g_total else 75.3,
        "total_points_std": statistics.stdev(g_total) if len(g_total) > 1 else 16.6,
        "avg_sets_played": statistics.fmean(g_sets) if g_sets else 4.0,
        "sets_played_std": statistics.stdev(g_sets) if len(g_sets) > 1 else 0.8,
        "sets_over_3_5_rate": (sum(1 for s in g_sets if s > 3.5) / len(g_sets)) if g_sets else 0.7,
        "total_over_75_5_rate": (g_total_over / len(g_total)) if g_total else 0.5,
    }
    return players, pairs, global_stats, n


def player_stats(log):
    """Career + recent-20 stats for one player (perspective = this player)."""
    if not log:
        return None
    firsts = [r["first"] for r in log]
    totals = [r["total"] for r in log]
    recent = log[-RECENT_N:]
    rfirsts = [r["first"] for r in recent]
    return {
        "matches": len(log),
        "wins": sum(1 for r in log if r["won"]),
        "win_rate": sum(1 for r in log if r["won"]) / len(log),
        "avg_sets": statistics.fmean(r["nsets"] for r in log),
        "ge4_rate": sum(1 for r in log if r["nsets"] >= 4) / len(log),
        "last10": [1 if r["won"] else 0 for r in log][-10:],
        "pts_per_set": statistics.fmean(r["points_for"] / r["nsets"] for r in log),
        "pts_against_per_set": statistics.fmean(r["points_against"] / r["nsets"] for r in log),
        "avg_point_diff": statistics.fmean(r["points_for"] - r["points_against"] for r in log),
        "avg_set_diff": statistics.fmean((r["first_won"] - (not r["first_won"])) * 0 for r in log),  # placeholder, fixed below
        "avg_total_points": statistics.fmean(totals),
        "std_total_points": statistics.stdev(totals) if len(totals) > 1 else 16.6,
        "avg_first_set_total": statistics.fmean(firsts),
        "std_first_set_total": statistics.stdev(firsts) if len(firsts) > 1 else 3.2,
        "first_set_over_18_5_rate": sum(1 for x in firsts if x > 18.5) / len(firsts),
        "first_set_win_rate": sum(1 for r in log if r["first_won"]) / len(log),
        "recent_win_rate": sum(1 for r in recent if r["won"]) / len(recent),
        "recent_avg_point_diff": statistics.fmean(r["points_for"] - r["points_against"] for r in recent),
        "recent_avg_first_set_total": statistics.fmean(rfirsts),
        "recent_first_set_over_18_5_rate": sum(1 for x in rfirsts if x > 18.5) / len(rfirsts),
    }


def h2h_info(pairs, a, b, board_a):
    rows = pairs.get(frozenset((a, b)), [])
    if not rows:
        return {"matches": 0, "player_a_win_rate": 0.5, "avg_first_set_total": None,
                "std_first_set_total": None, "first_set_over_18_5_rate": None,
                "avg_total_points": None, "std_total_points": None,
                "avg_sets_played": None, "recent_win_rate": None}
    desc = list(reversed(rows))
    a_wins = sum(1 for r in rows if r["winner"] == board_a)
    recent = desc[:H2H_RECENT]
    recent_wins = sum(1 for r in recent if r["winner"] == board_a)
    firsts = [r["first"] for r in rows]
    totals = [r["total"] for r in rows]
    return {
        "matches": len(rows),
        "player_a_win_rate": a_wins / len(rows),
        "avg_first_set_total": statistics.fmean(firsts),
        "std_first_set_total": statistics.stdev(firsts) if len(firsts) > 1 else None,
        "first_set_over_18_5_rate": sum(1 for x in firsts if x > 18.5) / len(firsts),
        "avg_total_points": statistics.fmean(totals),
        "std_total_points": statistics.stdev(totals) if len(totals) > 1 else None,
        "avg_sets_played": statistics.fmean(r["sets"] for r in rows),
        "recent_win_rate": recent_wins / len(recent),
    }


def player_type(st, g):
    if not st:
        return "not enough data"
    avg = st["avg_first_set_total"]
    recent = st["recent_avg_first_set_total"]
    over = st["first_set_over_18_5_rate"]
    recent_over = st["recent_first_set_over_18_5_rate"]
    std = st["std_first_set_total"]
    score = (avg - 18.5) * 0.22 + (recent - 18.5) * 0.25 + (over - 0.5) * 1.1 + (recent_over - 0.5) * 0.9
    vol = "volatile" if std >= 4.2 else "stable" if std <= 2.4 else "normal"
    if score >= 0.42:
        return f"fast over starter / {vol}"
    if score <= -0.42:
        return f"under starter / {vol}"
    return f"neutral starter / {vol}"


def predict(a, b, a_st, b_st, h, g, elo_a, elo_b):
    a_matches = a_st["matches"] if a_st else 0
    b_matches = b_st["matches"] if b_st else 0
    a_rel = reliability(a_matches)
    b_rel = reliability(b_matches)
    h2h_rel = reliability(h["matches"], full_at=20)

    v = lambda st, k, d: st[k] if st and st.get(k) is not None else d
    elo_p = 1 / (1 + 10 ** ((elo_b - elo_a) / 400))
    score = logit(elo_p)
    score += 0.60 * (v(a_st, "win_rate", 0.5) - v(b_st, "win_rate", 0.5)) * min(a_rel, b_rel)
    score += 1.10 * (v(a_st, "recent_win_rate", v(a_st, "win_rate", 0.5)) - v(b_st, "recent_win_rate", v(b_st, "win_rate", 0.5))) * min(a_rel, b_rel)
    score += 0.30 * (v(a_st, "first_set_win_rate", 0.5) - v(b_st, "first_set_win_rate", 0.5)) * min(a_rel, b_rel)
    score += 0.55 * (h["player_a_win_rate"] - 0.5) * h2h_rel
    score += 0.55 * ((h["recent_win_rate"] if h["recent_win_rate"] is not None else h["player_a_win_rate"]) - 0.5) * h2h_rel
    score += 0.32 * math.tanh((v(a_st, "avg_point_diff", 0.0) - v(b_st, "avg_point_diff", 0.0)) / 7.0) * min(a_rel, b_rel)
    score += 0.18 * math.tanh((v(a_st, "recent_avg_point_diff", 0.0) - v(b_st, "recent_avg_point_diff", 0.0)) / 7.0) * min(a_rel, b_rel)
    score *= 0.94
    win_a = clamp(sigmoid(score), 0.04, 0.96)

    # first set expectation
    exp_first = weighted_mean([
        (g["first_set_mean"], 1.00),
        (v(a_st, "avg_first_set_total", g["first_set_mean"]), 1.25 * a_rel),
        (v(b_st, "avg_first_set_total", g["first_set_mean"]), 1.25 * b_rel),
        (v(a_st, "recent_avg_first_set_total", g["first_set_mean"]), 0.90 * a_rel),
        (v(b_st, "recent_avg_first_set_total", g["first_set_mean"]), 0.90 * b_rel),
        (h["avg_first_set_total"], 1.80 * h2h_rel),
    ], g["first_set_mean"])
    exp_first += (0.5 - abs(win_a - 0.5)) * 1.00
    exp_first = clamp(exp_first, 11.0, 35.0)
    first_std = weighted_mean([
        (g["first_set_std"], 1.0),
        (v(a_st, "std_first_set_total", g["first_set_std"]), 0.6 * a_rel),
        (v(b_st, "std_first_set_total", g["first_set_std"]), 0.6 * b_rel),
        (h["std_first_set_total"], 1.0 * h2h_rel),
    ], g["first_set_std"])
    line_p185 = normal_over_prob(exp_first, 18.5, first_std)
    line_p195 = normal_over_prob(exp_first, 19.5, first_std)
    emp185 = weighted_mean([
        (g["first_set_over_18_5_rate"], 1.0),
        (v(a_st, "first_set_over_18_5_rate", g["first_set_over_18_5_rate"]), 1.2 * a_rel),
        (v(b_st, "first_set_over_18_5_rate", g["first_set_over_18_5_rate"]), 1.2 * b_rel),
        (v(a_st, "recent_first_set_over_18_5_rate", g["first_set_over_18_5_rate"]), 0.8 * a_rel),
        (v(b_st, "recent_first_set_over_18_5_rate", g["first_set_over_18_5_rate"]), 0.8 * b_rel),
        (h["first_set_over_18_5_rate"], 1.5 * h2h_rel),
    ], g["first_set_over_18_5_rate"])
    p_over_185 = clamp(0.55 * emp185 + 0.45 * line_p185, 0.03, 0.97)
    # 19.5 line: shift the 18.5 blend by the normal tail difference
    p_over_195 = clamp(p_over_185 - (line_p185 - line_p195), 0.03, 0.97)

    # total points expectation
    exp_total = weighted_mean([
        (g["total_points_mean"], 1.00),
        (v(a_st, "avg_total_points", g["total_points_mean"]), 1.25 * a_rel),
        (v(b_st, "avg_total_points", g["total_points_mean"]), 1.25 * b_rel),
    ], g["total_points_mean"])
    exp_total += ((0.5 - abs(win_a - 0.5)) * 5.4) - 1.1
    exp_total = clamp(exp_total, 33.0, 135.0)
    total_std = weighted_mean([
        (g["total_points_std"], 1.0),
        (v(a_st, "std_total_points", g["total_points_std"]), 0.6 * a_rel),
        (v(b_st, "std_total_points", g["total_points_std"]), 0.6 * b_rel),
        (h["std_total_points"], 1.0 * h2h_rel),
    ], g["total_points_std"])
    p_total_over = normal_over_prob(exp_total, 75.5, total_std)

    pick = "Over 18.5" if p_over_185 >= 0.5 else "Under 18.5"
    pick_p = max(p_over_185, 1 - p_over_185)
    conf = "STRONG" if pick_p >= 0.65 else "MODERATE" if pick_p >= 0.55 else "WEAK"

    return {
        "win": {"p1": round(win_a, 3), "p2": round(1 - win_a, 3)},
        "first_set": {
            "expected": round(exp_first, 1),
            "std": round(first_std, 2),
            "p_over_18_5": round(p_over_185, 3),
            "p_over_19_5": round(p_over_195, 3),
            "pick": pick,
            "prob": round(pick_p, 3),
            "confidence": conf,
        },
        "total_points": {"expected": round(exp_total, 1), "p_over_75_5": round(p_total_over, 3)},
        "h2h": {
            "n": h["matches"],
            "p1_wins": int(round(h["player_a_win_rate"] * h["matches"])) if h["matches"] else 0,
            "avg_first": round(h["avg_first_set_total"], 1) if h["avg_first_set_total"] else None,
            "over_18_5": round(h["first_set_over_18_5_rate"], 2) if h["first_set_over_18_5_rate"] is not None else None,
        },
        "data": {"p1_matches": a_st["matches"] if a_st else 0, "p2_matches": b_st["matches"] if b_st else 0},
        "types": {"p1": player_type(a_st, g), "p2": player_type(b_st, g)},
        "sets": sets_block(a_st, b_st, g),
        "profiles": {
            "p1": profile(a_st),
            "p2": profile(b_st),
        },
    }


def _v(st, k, d):
    return st[k] if st and st.get(k) is not None else d


def sets_block(a_st, b_st, g):
    """Sets O/U 3.5: real-data blend of both players' 4+ set rates + global."""
    ge4_a = _v(a_st, "ge4_rate", g["sets_over_3_5_rate"])
    ge4_b = _v(b_st, "ge4_rate", g["sets_over_3_5_rate"])
    p_ge4 = clamp(0.5 * (ge4_a + ge4_b) * 0.65 + g["sets_over_3_5_rate"] * 0.35, 0.05, 0.95)
    exp_sets = clamp(
        0.5 * (_v(a_st, "avg_sets", g["avg_sets_played"]) + _v(b_st, "avg_sets", g["avg_sets_played"])) * 0.65
        + g["avg_sets_played"] * 0.35,
        3.0, 5.0,
    )
    return {
        "expected": round(exp_sets, 2),
        "p_over_3_5": round(p_ge4, 3),
        "pick": "Over 3.5 sets" if p_ge4 >= 0.5 else "Under 3.5 sets",
        "prob": round(max(p_ge4, 1 - p_ge4), 3),
    }


def profile(st):
    """Real-data player dossier. None fields = unavailable (no fabricated data)."""
    if not st:
        return None
    return {
        "n": st["matches"],
        "wins": st["wins"],
        "win_rate": round(st["win_rate"] * 100, 1),
        "recent_win_rate": round(st["recent_win_rate"] * 100, 1),
        "pts_per_set": round(st["pts_per_set"], 1),
        "pts_against_per_set": round(st["pts_against_per_set"], 1),
        "first_set_win_rate": round(st["first_set_win_rate"] * 100, 1),
        "last10": st["last10"],
        "thin": st["matches"] < MIN_MATCHES,
    }


def api_get(path):
    req = urllib.request.Request(f"{SETKA_API}{path}", headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))


def pname(p):
    if not p:
        return ""
    return f"{p.get('firstName','')} {p.get('lastName','')}".strip()


def set_scores_text(scs):
    parts = []
    for ss in scs or []:
        a, b = ss.get("p1Score"), ss.get("p2Score")
        if a is not None and b is not None:
            parts.append(f"{a}-{b}")
    return ", ".join(parts)


STATUS = {1: "Scheduled", 2: "Live", 3: "Finished", 4: "Cancelled", 5: "Technical"}


def wat(iso):
    """ISO UTC -> 'HH:MM' WAT (UTC+1)."""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})", iso or "")
    if not m:
        return None
    h = (int(m.group(4)) + 1) % 24
    return f"{h:02d}:{m.group(5)}"


def main():
    date = time.strftime("%Y-%m-%d")
    t0 = time.time()
    print("loading setka history...")
    players, pairs, g, nhist = load_history()
    print(f"  {nhist} matches -> {len(players)} players, {len(pairs)} pairs")
    stats_cache = {}

    def st(name):
        if name not in stats_cache:
            stats_cache[name] = player_stats(players.get(name))
        return stats_cache[name]

    elo = {}
    if os.path.exists(ELO_CSV):
        with open(ELO_CSV, newline="") as f:
            for row in csv.DictReader(f):
                if row.get("player") and row.get("elo"):
                    try:
                        elo[row["player"].strip()] = float(row["elo"])
                    except ValueError:
                        pass

    # ---- today's matches from the official API --------------------------------
    games = []
    seen = set()
    try:
        near = api_get("/Matches/nearest/en") or []
        for m in near:
            p1 = f"{m.get('player1FirstName','')} {m.get('player1LastName','')}".strip()
            p2 = f"{m.get('player2FirstName','')} {m.get('player2LastName','')}".strip()
            mid = m.get("matchId")
            if not p1 or not p2 or mid in seen:
                continue
            seen.add(mid)
            games.append({
                "match_id": mid,
                "time_wat": wat(m.get("startDate")),
                "tournament": "",
                "status": "Scheduled",
                "p1": p1, "p2": p2,
                "set_scores": None, "score": None, "winner": None,
            })
    except Exception as e:
        print("  nearest API failed:", e)
    try:
        live = api_get("/Matches/widget/en") or []
        for m in live:
            p1, p2 = pname(m.get("player1")), pname(m.get("player2"))
            mid = m.get("id") or m.get("matchId")
            if not p1 or not p2:
                continue
            status = STATUS.get(int(m.get("statusId") or 1), "Unknown")
            entry = {
                "match_id": mid,
                "time_wat": wat(m.get("startDate")),
                "tournament": m.get("tournamentName", ""),
                "status": status,
                "p1": p1, "p2": p2,
                "set_scores": set_scores_text(m.get("setScores")),
                "score": [m.get("player1Score"), m.get("player2Score")],
                "winner": pname(m.get("winner")) or None,
            }
            if mid in seen:
                for gg in games:
                    if gg["match_id"] == mid:
                        gg.update(entry)
                        break
            else:
                seen.add(mid)
                games.append(entry)
    except Exception as e:
        print("  widget API failed:", e)

    games.sort(key=lambda x: x["time_wat"] or "")
    out_games = []
    for gg in games:
        h = h2h_info(pairs, gg["p1"], gg["p2"], gg["p1"])
        m = predict(gg["p1"], gg["p2"], st(gg["p1"]), st(gg["p2"]), h, g,
                    elo.get(gg["p1"], 1500), elo.get(gg["p2"], 1500))
        out_games.append({**gg, "model": m})

    out = {
        "date": date,
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "source": "setkacup official API + 155k-match history",
        "history": {"matches": nhist, "players": len(players)},
        "global": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in g.items()},
        "games": out_games,
    }
    os.makedirs(DAILY, exist_ok=True)
    with open(os.path.join(DAILY, f"{date}_setka.json"), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"{date}_setka.json: {len(out_games)} games in {time.time()-t0:.1f}s")


if __name__ == "__main__":
    main()
