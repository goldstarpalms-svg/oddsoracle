"""HT / HT-FT / Asian-handicap (±1.5) model for the daily football files.

Pure-stdlib Poisson. For each game in daily/<date>.json we have the full
model's 1/X/2 + O1.5/2.5/3.5 + BTTS probabilities. We invert those to
reconstruct the two team goal expectations (λ home, λ away), then:

  * split each half: first half gets 46% of expected goals (the standard
    football half split), second half the rest — independent Poisson;
  * HT 1/X/2 = half-time score matrix;
  * HT/FT = half-time score × second-half increment matrix (9 combos, top one);
  * AH ±1.5 = P(win by 2 or more) from the full-time score matrix.

Output: daily/<date>_halves.json
  { "date": ..., "games": { "Home|Away": {
      "ht": [h, x, a], "ht_pick": "1",
      "htft": {"combo": "1/1", "p": 37},
      "ah15": {"h": 44, "a": 12} } }

Idempotent — safe to re-run; only writes when output would change.
Run:  python3 backend/app/halves.py
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
HT_FRAC = 0.46  # share of expected goals that fall in the first half
MAXG = 12


def pois_pmf(lam, maxg=MAXG):
    return [math.exp(-lam) * lam ** k / math.factorial(k) for k in range(maxg + 1)]


def matrix(ph, pa):
    s = 0.0
    m = []
    for i in range(MAXG + 1):
        row = [ph[i] * pa[j] for j in range(MAXG + 1)]
        s += sum(row)
        m.append(row)
    for i in range(MAXG + 1):
        for j in range(MAXG + 1):
            m[i][j] /= s
    return m


def probs_of(m):
    p1 = sum(m[i][j] for i in range(MAXG + 1) for j in range(i))
    px = sum(m[i][i] for i in range(MAXG + 1))
    p2 = 1 - p1 - px
    tot = [sum(m[i][j] for i in range(MAXG + 1) for j in range(MAXG + 1) if i + j > n) for n in (1.5, 2.5, 3.5)]
    btts = sum(m[i][j] for i in range(1, MAXG + 1) for j in range(1, MAXG + 1))
    return p1, px, p2, tot, btts


def fit(lh, la, t):
    (p1, px, p2, tot, btts) = probs_of(matrix(pois_pmf(lh), pois_pmf(la)))
    e = (
        (p1 - t["p1"]) ** 2
        + (px - t["px"]) ** 2
        + (p2 - t["p2"]) ** 2
        + 2 * (tot[1] - t["o25"]) ** 2
        + (tot[0] - t["o15"]) ** 2
        + (btts - t["btts"]) ** 2
    )
    return e


def solve(t):
    # 1) full coarse grid scan, 2) local refinement passes
    best = None
    v = 0.1
    while v <= 4.0 + 1e-9:
        w = 0.1
        while w <= 4.0 + 1e-9:
            e = fit(v, w, t)
            if best is None or e < best[2]:
                best = (v, w, e)
            w = round(w + 0.1, 4)
        v = round(v + 0.1, 4)
    step = 0.02
    for _ in range(4):
        found = False
        for lh in [best[0] - step, best[0], best[0] + step]:
            for la in [best[1] - step, best[1], best[1] + step]:
                if lh < 0.08 or la < 0.08 or lh > 4.2 or la > 4.2:
                    continue
                e = fit(lh, la, t)
                if e < best[2] - 1e-12:
                    best = (round(lh, 4), round(la, 4), e)
                    found = True
        if not found:
            break
        step /= 4
    return best[0], best[1]


def half_split(lh, la):
    m1 = matrix(pois_pmf(lh * HT_FRAC), pois_pmf(la * HT_FRAC))
    m2 = matrix(pois_pmf(lh * (1 - HT_FRAC)), pois_pmf(la * (1 - HT_FRAC)))
    p1, px, p2, _, _ = probs_of(m1)
    return m1, m2, (p1, px, p2)


def htft_combos(m1, m2):
    # P(HT outcome a, FT outcome b)
    out = {}
    for (h, x) in [("1", 0), ("X", 1), ("2", 2)]:
        for (f, x2) in [("1", 0), ("X", 1), ("2", 2)]:
            out[f"{h}/{f}"] = 0.0
    for i in range(MAXG + 1):
        for j in range(MAXG + 1):
            hres = "1" if i > j else ("X" if i == j else "2")
            for di in range(MAXG + 1 - i):
                for dj in range(MAXG + 1 - j):
                    p = m1[i][j] * m2[di][dj]
                    fi, fj = i + di, j + dj
                    fres = "1" if fi > fj else ("X" if fi == fj else "2")
                    out[f"{hres}/{fres}"] += p
    return out


def main():
    written = 0
    for name in sorted(os.listdir(DAILY)):
        if not (name.endswith(".json") and re_date(name)):
            continue
        if "_halves" in name or name == "odds.json":
            continue
        path = os.path.join(DAILY, name)
        try:
            doc = json.load(open(path))
        except Exception:
            continue
        if not (isinstance(doc, dict) and doc.get("games")):
            continue
        out = {}
        for g in doc["games"]:
            m = g.get("model")
            if not m:
                continue
            key = f"{g['home']}|{g['away']}"
            try:
                t = {
                    "p1": m["p1"], "px": m["px"], "p2": m["p2"],
                    "o15": m.get("o15", 0.8), "o25": m.get("o25", 0.5), "btts": m.get("btts", 0.6),
                }
                lh, la = solve(t)
                m1, m2, (h1, hx, h2) = half_split(lh, la)
                combos = htft_combos(m1, m2)
                top_combo, top_p = max(combos.items(), key=lambda kv: kv[1])
                full = probs_of(matrix(pois_pmf(lh), pois_pmf(la)))
                # AH: P(home wins by 2+) / P(away wins by 2+)
                mf = matrix(pois_pmf(lh), pois_pmf(la))
                ah_h = sum(mf[i][j] for i in range(MAXG + 1) for j in range(MAXG + 1) if i - j >= 2)
                ah_a = sum(mf[i][j] for i in range(MAXG + 1) for j in range(MAXG + 1) if j - i >= 2)
                out[key] = {
                    "ht": [round(h1 * 100), round(hx * 100), round(h2 * 100)],
                    "ht_pick": "1" if h1 >= hx and h1 >= h2 else ("X" if hx >= h2 else "2"),
                    "htft": {"combo": top_combo, "p": round(top_p * 100)},
                    "ah15": {"h": round(ah_h * 100), "a": round(ah_a * 100)},
                }
            except Exception as e:
                print(f"  skip {key}: {e}")
        if not out:
            continue
        outp = os.path.join(DAILY, name.replace(".json", "_halves.json"))
        doc_out = {"date": name[:10], "games": out}
        try:
            old = json.load(open(outp))
            if old == doc_out:
                continue
        except Exception:
            pass
        json.dump(doc_out, open(outp, "w"), ensure_ascii=False, indent=1)
        print(f"{name} -> {os.path.basename(outp)} ({len(out)} games)")
        written += 1
    print(f"halves: {written} file(s) written")


def re_date(name):
    import re
    return bool(re.match(r"^\d{4}-\d{2}-\d{2}\.json$", name))


if __name__ == "__main__":
    main()
