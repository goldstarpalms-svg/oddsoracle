"""Is there any league where the model beats the closing price?"""
from __future__ import annotations
import numpy as np, pandas as pd
from core import PoissonDC, load_matches
from backtest import devig, metrics, bet_roi, EPS

df = load_matches()
df = df[df["B365H"].notna() & df["B365D"].notna() & df["B365A"].notna()]
df = df.sort_values("Date").reset_index(drop=True)

rows = []
for lg, g in df.groupby("league"):
    g = g.sort_values("Date").reset_index(drop=True)
    if len(g) < 400:
        continue
    cut = int(len(g) * 0.65)
    train, test = g.iloc[:cut], g.iloc[cut:]
    m = PoissonDC(sot_weight=0.35).fit(train)
    if m.att_ is None:
        continue
    preds, bets = [], []
    for _, r in test.iterrows():
        dv = devig(r)
        pr = m.probs(r["home"], r["away"])
        if dv is None or pr is None:
            continue
        pm = np.array(pr[:3]); pm = pm / pm.sum()
        res = 0 if r["FTHG"] > r["FTAG"] else (1 if r["FTHG"] == r["FTAG"] else 2)
        preds.append((res, pm, dv))
        sel = int(np.argmax(pm))
        bets.append({"edge": pm[sel] - dv[sel],
                     "odds": float([r["B365H"], r["B365D"], r["B365A"]][sel]),
                     "win": sel == res})
    if len(preds) < 120:
        continue
    y = np.array([p[0] for p in preds])
    pm_m = np.array([p[1] for p in preds])
    pm_k = np.array([p[2] for p in preds])
    mm = metrics(y, pm_m)["logloss"]; mk = metrics(y, pm_k)["logloss"]
    roi = bet_roi(bets, 5)
    rows.append((lg, len(y), mm, mk, mk - mm, roi["bets"], roi["roi"]))

out = pd.DataFrame(rows, columns=["league","n","model_ll","market_ll","delta","bets","roi_5pp"])
out = out.sort_values("delta", ascending=False)
print(out.to_string(index=False, float_format=lambda x: f"{x:.4f}"))
pos = out[out["delta"] > 0]
print(f"\nleagues where the model beats the closing price: {len(pos)} of {len(out)}")
print(f"leagues with positive ROI at 5pp edge: {len(out[out['roi_5pp'].fillna(-999) > 0])} of {len(out)}")
