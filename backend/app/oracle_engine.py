"""OddsOracle prediction engine v2.0 — the intelligence layer.

For every football game in daily/<date>.json the engine:

  1. FITS the Poisson goal expectations (λ home, λ away) from the model's
     published probabilities (p1/px/p2, O1.5/O2.5/O3.5, BTTS) — same fit
     as halves.py, so every downstream number comes from ONE honest model.
  2. RUNS a 10,000-scene Monte Carlo simulation of the full match and of
     the first half (46/54 goal split) → distributions for 1X2, O/U 2.5,
     BTTS, HT and top correct scores, plus their spread.
  3. RUNS every independent probability engine we have data for:
        E1 Poisson (our fitted model)
        E2 Market   (bookmaker price, vig removed)
        E3 Forebet  (forebet's board probabilities, when they cover the game)
        E4 Form     (last-5 W/D/L points, when H2H data has landed)
     and counts MODEL AGREEMENT (e.g. "3/3 engines agree on Home").
  4. COMPUTES edge + expected value per market (model % vs market %),
     classifies the SIGNAL:
        STRONG VALUE / VALUE / FAIR / NO EDGE / AVOID / PASS
     PASS = the engine declines the match (no meaningful pricing edge) —
     we would rather say "no bet" than force a pick.
  5. SCORES DATA QUALITY (how complete the underlying data is) and an
     ORACLE SCORE (0-100 analytical signal score — explicitly NOT a win
     probability).
  6. WRITES the WHY FACTORS — the actual inputs that moved the number
     (goal expectations, H2H, form, simulation, price) as plus/minus list.

Output (auditable prediction schema): daily/<date>_oracle.json
  games: { "Home|Away": {
      prediction_id, event, sport, league, market, selection,
      odds, model_probability, market_probability, edge, ev_pct,
      signal, oracle_score, confidence, data_quality,
      models: [{name, p1, px, p2, pick, agrees}], agreement: "3/3",
      mc: {h, x, a, o25, btts, ht, top2}, lambda: [lh, la],
      why: {plus: [...], minus: [...]},
      model_version, data_timestamp, status, result } }

Pure stdlib. Idempotent. Run:  python3 backend/app/oracle_engine.py
"""
import json
import math
import os
import random
import re
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY = os.path.join(HERE, "daily")
sys.path.insert(0, HERE)
from halves import solve, matrix, probs_of, pois_pmf, MAXG, HT_FRAC  # noqa: E402

MODEL_VERSION = "oracle-v2.0"
N_SIMS = 10000
RNG_SEED = 20260920  # deterministic sims → reproducible scores


def poisson_sample(rng, lam):
    # Knuth
    if lam <= 0.01:
        return 0
    L = math.exp(-lam)
    k, p = 0, 1.0
    while True:
        p *= rng.random()
        if p <= L:
            return k
        k += 1


def monte_carlo(rng, lh, la, n=N_SIMS):
    h = x = a = 0
    o25 = o15 = o35 = btts = 0
    ht_home = ht_x = ht_away = 0
    scores = {}
    for _ in range(n):
        gh = poisson_sample(rng, lh)
        ga = poisson_sample(rng, la)
        if gh > ga:
            h += 1
        elif gh == ga:
            x += 1
        else:
            a += 1
        tot = gh + ga
        if tot > 2.5:
            o25 += 1
        if tot > 1.5:
            o15 += 1
        if tot > 3.5:
            o35 += 1
        if gh > 0 and ga > 0:
            btts += 1
        # first half (independent Poisson on the 46% split)
        hh = poisson_sample(rng, lh * HT_FRAC)
        ha = poisson_sample(rng, la * HT_FRAC)
        if hh > ha:
            ht_home += 1
        elif hh == ha:
            ht_x += 1
        else:
            ht_away += 1
        scores[f"{gh}-{ga}"] = scores.get(f"{gh}-{ga}", 0) + 1
    top = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))[:2]
    pct = lambda c: round(100 * c / n)
    return {
        "h": pct(h), "x": pct(x), "a": pct(a),
        "o15": pct(o15), "o25": pct(o25), "o35": pct(o35), "btts": pct(btts),
        "ht": [pct(ht_home), pct(ht_x), pct(ht_away)],
        "top2": [f"{k} ({round(100 * v / n)}%)" for k, v in top],
    }


def devig3(odds):
    """Remove vig from [1, X, 2] decimal odds → probabilities 0-1."""
    if not odds or any((not isinstance(o, (int, float))) or o <= 1 for o in odds):
        return None
    inv = [1.0 / o for o in odds]
    s = sum(inv)
    return [p / s for p in inv]


def argmax3(p):
    return "1" if p[0] >= p[1] and p[0] >= p[2] else ("X" if p[1] >= p[2] else "2")


def form_points(form_str):
    s = re.sub(r"[^WDL]", "", str(form_str or "").upper())
    if not s:
        return None
    pts = 0
    for c in s[:5]:
        pts += {"W": 3, "D": 1}.get(c, 0)
    return pts  # 0..15


def form_model(ph_pts, pa_pts):
    """Logistic on last-5 points difference → crude but independent read."""
    if ph_pts is None or pa_pts is None:
        return None
    diff = (ph_pts - pa_pts) / 5.0  # -1..1
    p1 = 1 / (1 + math.exp(-2.2 * diff))
    p2 = 1 - p1
    px = 0.24 * (1 - abs(diff))  # draws more likely when form is even
    s = p1 + p2 + px
    return [p1 / s, px / s, p2 / s]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


def main():
    rng = random.Random(RNG_SEED)
    for name in sorted(os.listdir(DAILY)):
        if not re.match(r"^\d{4}-\d{2}-\d{2}\.json$", name):
            continue
        try:
            doc = json.load(open(os.path.join(DAILY, name)))
        except Exception:
            continue
        games = doc.get("games") or []
        if not games:
            continue
        date = name[:10]

        board = {}
        try:
            for r in json.load(open(os.path.join(DAILY, f"{date}_full_crack.json"))):
                board[f"{r['home']}|{r['away']}"] = r
        except Exception:
            pass
        h2h = {}
        try:
            h2h = (json.load(open(os.path.join(DAILY, f"{date}_h2h.json"))).get("games") or {})
        except Exception:
            pass
        oddsapi = []
        prices_stale = False
        try:
            for f in sorted(os.listdir(DAILY)):
                if f.startswith(date) and f.endswith("_oddspapi.json"):
                    doc_o = json.load(open(os.path.join(DAILY, f)))
                    oddsapi = doc_o.get("soccer") or []
                    gen = str(doc_o.get("generatedAt") or "")[:10]
                    prices_stale = bool(gen) and gen < date
                    break
            else:
                # no same-date oddspapi file — prices (if any) are from earlier
                for f in sorted(os.listdir(DAILY), reverse=True):
                    if f.endswith("_oddspapi.json") or f.endswith("_markets.json"):
                        doc_o = json.load(open(os.path.join(DAILY, f)))
                        gen = str(doc_o.get("generatedAt") or f[:10])[:10]
                        prices_stale = gen < date
                        break
        except Exception:
            pass

        out = {}
        for g in games:
            m = g.get("model")
            if not m:
                continue
            key = f"{g['home']}|{g['away']}"
            home, away = g["home"], g["away"]
            row = board.get(key) or {}
            mkt_dec = row.get("mkt_dec")
            fb_pct = row.get("fb_pct") if row.get("fb_pct") and any(row.get("fb_pct")) else None
            target = {
                "p1": m["p1"], "px": m["px"], "p2": m["p2"],
                "o15": m.get("o15", 0.8), "o25": m.get("o25", 0.5), "btts": m.get("btts", 0.6),
            }
            try:
                lh, la = solve(target)
            except Exception:
                continue
            mc = monte_carlo(rng, lh, la)
            poisson_p = [round(100 * m["p1"]), round(100 * m["px"]), round(100 * m["p2"])]

            # ---- engines -------------------------------------------------
            models = []
            models.append({"name": "Poisson", "p": poisson_p, "pick": argmax3([m["p1"], m["px"], m["p2"]])})
            mkt_p = devig3(mkt_dec)
            if mkt_p:
                models.append({"name": "Market", "p": [round(100 * v) for v in mkt_p], "pick": argmax3(mkt_p)})
            if fb_pct:
                fps = [float(v) for v in fb_pct]
                if sum(fps) >= 95:
                    models.append({"name": "Forebet", "p": fb_pct, "pick": argmax3(fps)})
            h = h2h.get(key) or {}
            form = h.get("form") or {}
            ph_pts = form_points(form.get("home"))
            pa_pts = form_points(form.get("away"))
            fp = form_model(ph_pts, pa_pts)
            if fp:
                models.append({"name": "Form", "p": [round(100 * v) for v in fp], "pick": argmax3(fp)})
            picks = [x["pick"] for x in models]
            best_count = max(picks.count(p) for p in set(picks))
            agree_pick = picks[picks.index(max(set(picks), key=picks.count))] if picks else None
            for x in models:
                x["agrees"] = x["pick"] == agree_pick
            agreement = f"{best_count}/{len(models)}"

            # ---- edge + EV per market ------------------------------------
            # 1X2 (model MC vs devigged market)
            best_edge = None
            best_market = None
            ev_pct = None
            sel_odds = None
            if mkt_p:
                model_side = [mc["h"], mc["x"], mc["a"]]
                for i, side in enumerate(("1", "X", "2")):
                    edge = model_side[i] - round(100 * mkt_p[i])
                    if best_edge is None or edge > best_edge:
                        best_edge = edge
                        best_market = side
                        sel_odds = mkt_dec[i]
                sel_p = [mc["h"], mc["x"], mc["a"]][("1", "X", "2").index(best_market)]
                ev_pct = round((sel_p / 100) * sel_odds * 100 - 100, 1)
            # O/U 2.5 (model vs oddspapi total when matched)
            ou_edge = None
            ou_odds = None
            for g2 in oddsapi:
                if norm(g2.get("home", "")) == norm(home) and norm(g2.get("away", "")) == norm(away):
                    best = None
                    for b in g2.get("bookmakers") or []:
                        for t in b.get("totals") or []:
                            if t.get("line") == 2.5 and t.get("over"):
                                if best is None or t["over"] > best[0]:
                                    best = [t["over"], b.get("name")]
                    if best:
                        ou_edge = mc["o25"] - round(100 / best[0])
                        ou_odds = best[0]
                    break

            edges = [e for e in (best_edge, ou_edge) if e is not None]
            max_edge = max(edges) if edges else None

            # ---- price validation (no fake precision) -----------------------
            # A price that deviates >20pp from the model's favourite, or a
            # price file older than the board date, is not trusted enough for
            # a STRONG call: cap the signal at VALUE and say so.
            mkt_wide = False
            if mkt_p:
                mx_mkt = max(100 * v for v in mkt_p)
                mx_mod = max(mc["h"], mc["x"], mc["a"])
                mkt_wide = (mx_mkt - mx_mod) > 20 or (mx_mod - mx_mkt) > 20
            price_note = []
            if prices_stale:
                price_note.append("Market prices are from a previous day (refresh pending) — edge is an estimate, not live.")
            if mkt_wide:
                price_note.append("Price deviates sharply from the model — treated as untrusted for a strong call.")

            # ---- signal ---------------------------------------------------
            conf = max(mc["h"], mc["x"], mc["a"])
            if max_edge is None:
                signal = "NO EDGE"
            elif max_edge >= 8 or (ev_pct is not None and ev_pct >= 8):
                signal = "STRONG VALUE"
            elif max_edge >= 4:
                signal = "VALUE"
            elif max_edge >= 1.5:
                signal = "FAIR"
            elif max_edge < -5:
                signal = "AVOID"
            elif conf < 70:
                signal = "PASS"
            else:
                signal = "NO EDGE"
            if signal == "STRONG VALUE" and (prices_stale or mkt_wide):
                signal = "VALUE"
            price_minuses = price_note

            # ---- data quality + oracle score --------------------------------
            have = {
                "model": True,
                "market_1x2": mkt_p is not None,
                "forebet": fb_pct is not None,
                "market_ou": ou_edge is not None,
                "h2h": bool(h.get("h2h")),
                "form": ph_pts is not None and pa_pts is not None,
            }
            data_quality = round(100 * sum(have.values()) / len(have))
            edge_strength = max(0.0, min(max_edge or 0.0, 10.0)) / 10.0 * 40
            if (max_edge or 0) < 0:
                edge_strength = 0
            score = round(
                edge_strength
                + 20 * conf / 100.0
                + 20 * best_count / max(1, len(models))
                + 20 * data_quality / 100.0
            )
            if signal == "AVOID":
                score = min(score, 30)

            # ---- why factors (real inputs only) -----------------------------
            plus, minus = [], []
            plus.append(f"Expected goals (Poisson fit): {home} {lh:.2f} — {la:.2f} {away}")
            if lh > la * 1.15:
                plus.append(f"{home} expected to outscore {away} by {(lh - la):.1f} goals")
            elif la > lh * 1.15:
                minus.append(f"{away} expected to outscore {home} by {(la - lh):.1f} goals")
            else:
                plus.append("Goal expectations are close — this is a tight model")
            h2h_rows = (h.get("h2h") or [])[:5]
            if h2h_rows:
                hw = aw = dr = 0
                for rrow in h2h_rows:
                    a_, b_ = str(rrow[1]).split("-")[:2]
                    n1, n2 = rrow[2], rrow[3]
                    try:
                        a_, b_ = int(a_), int(b_)
                    except Exception:
                        continue
                    hh = a_ if (n1 and norm(n1) and norm(n1) in norm(home)) else b_
                    gg = b_ if (n1 and norm(n1) and norm(n1) in norm(home)) else a_
                    if hh > gg:
                        hw += 1
                    elif gg > hh:
                        aw += 1
                    else:
                        dr += 1
                if hw > aw:
                    plus.append(f"H2H: {home} leads history {hw}-{aw} ({dr} draws)")
                elif aw > hw:
                    minus.append(f"H2H: {away} leads history {aw}-{hw} ({dr} draws)")
            if ph_pts is not None and pa_pts is not None:
                if ph_pts > pa_pts:
                    plus.append(f"Form (last 5): {home} {ph_pts} pts — {pa_pts} {away}")
                elif pa_pts > ph_pts:
                    minus.append(f"Form (last 5): {away} {pa_pts} pts — {ph_pts} {home}")
            if fb_pct and fb_pct[("1", "X", "2").index(best_market or "1")] > 55:
                plus.append(f"Forebet's board also backs {best_market} ({fb_pct[('1','X','2').index(best_market or '1')]}%)")
            if best_edge is not None and best_edge >= 3:
                plus.append(f"Price underprices our model on {best_market} by {best_edge}pp")
            elif best_edge is not None and best_edge <= -3:
                minus.append(f"Price already covers us on {best_market} ({best_edge}pp against)")
            plus.append(f"Monte Carlo ({N_SIMS:,} sims): {mc['h']}/{mc['x']}/{mc['a']} · O2.5 {mc['o25']}% · BTTS {mc['btts']}%")
            if best_count == len(models) and len(models) >= 2:
                plus.append(f"All {len(models)} engines agree on {agree_pick}")
            minus.extend(price_minuses)

            out[key] = {
                "prediction_id": f"{date}-{norm(home)}-v-{norm(away)}",
                "event": f"{home} v {away}",
                "sport": "football",
                "league": g.get("league", ""),
                "market": "1X2",
                "selection": best_market or argmax3([m["p1"], m["px"], m["p2"]]),
                "odds": round(sel_odds, 2) if sel_odds else None,
                "model_probability": [mc["h"], mc["x"], mc["a"]],
                "market_probability": [round(100 * v) for v in mkt_p] if mkt_p else None,
                "edge": max_edge,
                "ev_pct": ev_pct,
                "signal": signal,
                "oracle_score": score,
                "confidence": conf,
                "data_quality": data_quality,
                "models": [{"name": x["name"], "p": x["p"], "pick": x["pick"], "agrees": x["agrees"]} for x in models],
                "agreement": agreement,
                "mc": mc,
                "lambda": [round(lh, 3), round(la, 3)],
                "why": {"plus": plus, "minus": minus},
                "model_version": MODEL_VERSION,
                "data_timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "status": "published",
                "result": None,
            }

        outp = os.path.join(DAILY, f"{date}_oracle.json")
        doc_out = {"date": date, "model_version": MODEL_VERSION, "n_sims": N_SIMS, "games": out}
        try:
            old = json.load(open(outp))
            if old == doc_out:
                continue
        except Exception:
            pass
        json.dump(doc_out, open(outp, "w"), ensure_ascii=False)
        print(f"{name} -> {os.path.basename(outp)} ({len(out)} games)")
    print("oracle engine done")


if __name__ == "__main__":
    main()
