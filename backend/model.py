"""
Poisson xG hybrid model v2 — weekend predictions with tuned shrinkage
  Stage 1: fit 2425 (goals) -> predict 2526, tune shrinkage weight w per league
  Stage 2: live model 2526 goals + 2627 xG blend -> predict 18-20 Sep 2026
  Stage 3: confidence ranking + sensitivity
"""
import pandas as pd
import numpy as np
from scipy.stats import poisson

pd.set_option("display.width", 250)

LEAGUES = {"E0": "Premier League", "SP1": "La Liga", "D1": "Bundesliga", "I1": "Serie A", "F1": "Ligue 1"}

FIXTURES = {
    "E0": [("Tottenham", "Aston Villa"), ("Brighton", "Arsenal"), ("Everton", "Ipswich"),
           ("Newcastle", "Hull"), ("Nott'm Forest", "Coventry"), ("Bournemouth", "Liverpool"),
           ("Leeds", "Crystal Palace"), ("Man City", "Sunderland"), ("Fulham", "Man United")],
    "SP1": [("Espanol", "Elche"), ("Osasuna", "Vallecano"), ("Ath Bilbao", "Alaves"),
            ("Celta", "Santander"), ("Sevilla", "Barcelona"), ("Getafe", "Malaga"),
            ("Ath Madrid", "Real Madrid"), ("La Coruna", "Betis"), ("Villarreal", "Levante"),
            ("Valencia", "Sociedad")],
    "D1": [("Bayern Munich", "Union Berlin"), ("Ein Frankfurt", "Freiburg"), ("M'gladbach", "Mainz"),
           ("Hamburg", "FC Koln"), ("Werder Bremen", "Augsburg"), ("Stuttgart", "Dortmund"),
           ("Leverkusen", "RB Leipzig"), ("Schalke 04", "Elversberg"), ("Paderborn", "Hoffenheim")],
    "I1": [("Bologna", "Torino"), ("Udinese", "Cagliari"), ("Roma", "Inter"), ("Venezia", "Lazio"),
           ("Fiorentina", "Napoli"), ("Frosinone", "Como"), ("Parma", "Genoa"),
           ("Juventus", "Atalanta"), ("Milan", "Lecce")],
    "F1": [("Monaco", "Lens"), ("Angers", "Troyes"), ("Auxerre", "Brest"), ("Le Mans", "Lorient"),
           ("Lyon", "Rennes"), ("Marseille", "Paris SG"), ("Nice", "Lille"),
           ("Paris FC", "Strasbourg"), ("Toulouse", "Le Havre")],
}


def load(season, lg):
    df = pd.read_csv(f"data/{season}_{lg}.csv")
    df = df[df["FTHG"].notna()].copy()
    return df


def season_strengths(df, use_xg=False):
    recs = []
    for _, r in df.iterrows():
        f = r["HxG"] if use_xg else r["FTHG"]
        a = r["AxG"] if use_xg else r["FTAG"]
        if use_xg and (pd.isna(f) or pd.isna(a)):
            f, a = r["FTHG"], r["FTAG"]
        recs.append((r["HomeTeam"], f, a))
        recs.append((r["AwayTeam"], a, f))
    t = pd.DataFrame(recs, columns=["team", "gf", "against"])
    g = t.groupby("team").agg(gf=("gf", "mean"), against=("against", "mean"), n=("gf", "count"))
    la = t["gf"].mean()
    g["attack"] = g["gf"] / la
    g["defence"] = g["against"] / la
    if use_xg and df["HxG"].notna().any():
        return g, df["HxG"].mean(), df["AxG"].mean()
    return g, df["FTHG"].mean(), df["FTAG"].mean()


def matrix(lh, la, maxg=10):
    ph = poisson.pmf(np.arange(maxg + 1), lh)
    pa = poisson.pmf(np.arange(maxg + 1), la)
    return np.outer(ph, pa)


def probs_from_matrix(m):
    s = m.sum()
    p = np.array([m[np.tril_indices(len(m), -1)].sum(), m.diagonal().sum(),
                  m[np.triu_indices(len(m), 1)].sum()]) / s
    i, j = np.indices(m.shape)
    o25 = m[(i + j) >= 3].sum() / s
    btts = 1 - m[0, :].sum() / s - m[:, 0].sum() / s + m[0, 0] / s
    return p, o25, btts, m / s


def match_probs(s, A_home, A_away, home, away, w):
    """Poisson probs shrunk toward league baseline by weight w."""
    sh, sa = s.loc[home], s.loc[away]
    lh = A_home * sh["attack"] * sa["defence"]
    la = A_away * sa["attack"] * sh["defence"]
    pm = probs_from_matrix(matrix(lh, la))[0]
    pb = probs_from_matrix(matrix(A_home, A_away))[0]
    p = w * pm + (1 - w) * pb
    _, o25, btts, mm = probs_from_matrix(matrix(lh, la))
    return p, o25, btts, mm


def top_scorelines(mm, k=2):
    flat = mm.flatten()
    idx = np.argsort(flat)[::-1][:k]
    return [(i // len(mm), i % len(mm), flat[i]) for i in idx]


def backtest(lg, w_grid=(0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0)):
    d_fit, d_test = load("2425", lg), load("2526", lg)
    s, A_home, A_away = season_strengths(d_fit, use_xg=False)
    best = (None, np.inf)
    results = {}
    for w in w_grid:
        ll, brier, acc, n = 0.0, 0.0, 0, 0
        for _, r in d_test.iterrows():
            h, a = r["HomeTeam"], r["AwayTeam"]
            if h not in s.index or a not in s.index:
                continue
            p, *_ = match_probs(s, A_home, A_away, h, a, w)
            y = {"H": 0, "D": 1, "A": 2}[r["FTR"]]
            p = np.clip(p, 1e-6, 1)
            ll -= np.log(p[y])
            brier += (p - np.eye(3)[y]) ** 2
            acc += (np.argmax(p) == y)
            n += 1
        results[w] = (ll / n, brier / n, acc / n)
        if ll / n < best[1]:
            best = (w, ll / n)
    return best[0], results, n, s, A_home, A_away


def live_strengths(lg):
    """Blend 2526 (goals) + 2627 (xG) by effective sample size.
    Current season gets a 2x recency boost; weights per team vary with games played."""
    d25, d26 = load("2526", lg), load("2627", lg)
    s25, _, _ = season_strengths(d25, use_xg=False)
    s26, _, _ = season_strengths(d26, use_xg=True)
    A_home = d26["HxG"].mean() if d26["HxG"].notna().any() else d26["FTHG"].mean()
    A_away = d26["AxG"].mean() if d26["AxG"].notna().any() else d26["FTAG"].mean()
    out = s26.copy()
    n25 = s25["n"].reindex(s26.index)
    n26 = s26["n"]
    w26 = (2.0 * n26) / (n25 + 2.0 * n26)  # NaN where team not in 2526
    for col in ("attack", "defence"):
        v25 = s25[col].reindex(s26.index)
        mask = v25.notna()
        out.loc[mask, col] = (1 - w26[mask]) * v25[mask] + w26[mask] * s26.loc[mask, col]
    return out, A_home, A_away, s25, s26, w26


def main():
    print("=" * 104)
    print("STAGE 1 — BACKTEST + SHRINKAGE TUNING  (fit 24/25 goals -> predict 25/26)")
    print("=" * 104)
    tuned = {}
    for lg in LEAGUES:
        w, res, n, s, Ah, Aa = backtest(lg)
        tuned[lg] = w
        line = "  ".join(f"w={ww}:{ll:.4f}" for ww, (ll, _, _) in res.items())
        print(f"{LEAGUES[lg]:<15} n={n}  best w={w:.2f}  (logloss by w: {line})")
    print()

    print("=" * 104)
    print("STAGE 2 — WEEKEND PREDICTIONS 18-20 Sep 2026 (shrinkage tuned per league)")
    print("=" * 104)
    all_rows, sens_rows = [], []
    for lg in LEAGUES:
        s_live, Ah, Aa, s25, s26, w26 = live_strengths(lg)
        w = tuned[lg]
        print(f"\n### {LEAGUES[lg]}  (avg xG/match home {Ah:.2f} / away {Aa:.2f}; "
              f"shrinkage w={w:.2f}; 26/27 data weight {w26.mean()*100:.0f}%)")
        hdr = f"{'Fixture':<32}{'P(H)':>7}{'P(D)':>7}{'P(A)':>7}  {'Pick':<15}{'Top scorelines':<24}{'O2.5':>7}{'BTTS':>7}"
        print(hdr)
        print("-" * len(hdr))
        for home, away in FIXTURES[lg]:
            p, o25, btts, mm = match_probs(s_live, Ah, Aa, home, away, w)
            ph, pd_, pa = p
            lab = ["HOME", "DRAW", "AWAY"][int(np.argmax(p))]
            pick = home if lab == "HOME" else "Draw" if lab == "DRAW" else away
            sl = "  ".join(f"{i}-{j} ({q*100:.0f}%)" for i, j, q in top_scorelines(mm))
            print(f"{home+' v '+away:<32}{ph*100:>6.1f}%{pd_*100:>6.1f}%{pa*100:>6.1f}%  {pick:<15}{sl:<24}{o25*100:>6.1f}%{btts*100:>6.1f}%")
            all_rows.append(dict(league=LEAGUES[lg], home=home, away=away,
                                 ph=ph, pd=pd_, pa=pa, o25=o25, btts=btts))
            p26 = match_probs(s26, Ah, Aa, home, away, 1.0)[0]
            if home in s25.index and away in s25.index:
                p25 = match_probs(s25, Ah, Aa, home, away, 1.0)[0]
                sens_rows.append(abs(p25 - p26).max())
            else:
                sens_rows.append(np.nan)  # promoted team: no 2526 baseline
    pred = pd.DataFrame(all_rows)
    pred.to_csv("predictions_weekend.csv", index=False)

    print("\n" + "=" * 104)
    print("STAGE 3 — CONFIDENCE RANKING")
    print("=" * 104)
    pred["max_p"] = pred[["ph", "pd", "pa"]].max(axis=1)
    top = pred.sort_values("max_p", ascending=False).head(12)
    for _, r in top.iterrows():
        pick = r["home"] if r["max_p"] == r["ph"] else ("Draw" if r["max_p"] == r["pd"] else r["away"])
        print(f"{r['league']:<15} {r['home']+' v '+r['away']:<34} {r['max_p']*100:5.1f}%  -> {pick:<14} (fair odds {1/r['max_p']:.2f})")
    s_arr = np.array(sens_rows, dtype=float)
    print(f"\nSensitivity (max |P diff|, 2526-only vs 2627-only; {np.isfinite(s_arr).sum()} of {len(s_arr)} fixtures, promoted teams excluded):")
    print(f"  mean {np.nanmean(s_arr)*100:.1f}pp, median {np.nanmedian(s_arr)*100:.1f}pp, max {np.nanmax(s_arr)*100:.1f}pp")
    print("Saved -> predictions_weekend.csv")


if __name__ == "__main__":
    main()
