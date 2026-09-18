"""Value analysis: model probs (predictions_weekend.csv) vs market odds (Forebet book)."""
import pandas as pd
import numpy as np

# American odds (H, D, A) per fixture, H/D/A order
MARKET = {
    # EPL
    "Tottenham v Aston Villa": (250, 250, 275),
    "Newcastle v Hull": (333, 333, 400),
    "Everton v Ipswich": (-133, 280, 375),
    "Brighton v Arsenal": (400, 290, -152),
    "Nott'm Forest v Coventry": (-167, 300, 450),
    "Man City v Sunderland": (-333, 450, 800),
    "Leeds v Crystal Palace": (-133, 280, 350),
    "Bournemouth v Liverpool": (210, 280, 115),
    "Fulham v Man United": (250, 280, 100),
    # La Liga
    "Espanol v Elche": (-120, 250, 350),
    "Osasuna v Vallecano": (135, 230, 210),
    "Ath Bilbao v Alaves": (-152, 275, 425),
    "Celta v Santander": (-125, 280, 320),
    "Sevilla v Barcelona": (1000, 650, -500),
    "Getafe v Malaga": (105, 210, 290),
    "Ath Madrid v Real Madrid": (240, 290, -105),
    "La Coruna v Betis": (231, 264, 119),
    "Villarreal v Levante": (-182, 320, 450),
    "Valencia v Sociedad": (162, 240, 155),
    # Bundesliga
    "Bayern Munich v Union Berlin": (-2000, 1400, 2200),
    "Ein Frankfurt v Freiburg": (130, 290, 175),
    "M'gladbach v Mainz": (200, 275, 120),
    "Hamburg v FC Koln": (170, 260, 145),
    "Werder Bremen v Augsburg": (130, 280, 180),
    "Stuttgart v Dortmund": (135, 275, 180),
    "Leverkusen v RB Leipzig": (-105, 320, 225),
    "Schalke 04 v Elversberg": (100, 270, 250),
    "Paderborn v Hoffenheim": (333, 350, -152),
    # Serie A
    "Bologna v Torino": (-111, 250, 300),
    "Udinese v Cagliari": (125, 230, 230),
    "Roma v Inter": (170, 240, 155),
    "Venezia v Lazio": (290, 250, -111),
    "Fiorentina v Napoli": (230, 240, 120),
    "Frosinone v Como": (500, 350, -200),
    "Parma v Genoa": (210, 210, 145),
    "Juventus v Atalanta": (-143, 290, 375),
    "Milan v Lecce": (-370, 475, 1000),
    # Ligue 1
    "Monaco v Lens": (100, 275, 250),
    "Angers v Troyes": (120, 230, 240),
    "Auxerre v Brest": (180, 250, 145),
    "Le Mans v Lorient": (170, 230, 162),
    "Lyon v Rennes": (110, 270, 220),
    "Marseille v Paris SG": (600, 400, -250),
    "Nice v Lille": (260, 250, 105),
    "Paris FC v Strasbourg": (-105, 275, 260),
    "Toulouse v Le Havre": (-139, 270, 400),
}


def american_to_dec(o):
    return 1 + o / 100 if o > 0 else 1 + 100 / abs(o)


pred = pd.read_csv("predictions_weekend.csv")
rows = []
for _, r in pred.iterrows():
    key = f"{r['home']} v {r['away']}"
    if key not in MARKET:
        continue
    ah, ad, aa = MARKET[key]
    dh, dd, da = (american_to_dec(x) for x in (ah, ad, aa))
    imp = np.array([1/dh, 1/dd, 1/da])
    mkt = imp / imp.sum()  # devigged
    model = np.array([r["ph"], r["pd"], r["pa"]])
    ev = model * np.array([dh, dd, da]) - 1
    rows.append(dict(fixture=key, league=r["league"], home=r["home"], away=r["away"],
                     mH=mkt[0], mD=mkt[1], mA=mkt[2],
                     xH=model[0], xD=model[1], xA=model[2],
                     dH=model[0]-mkt[0], dD=model[1]-mkt[1], dA=model[2]-mkt[2],
                     evH=ev[0], evD=ev[1], evA=ev[2],
                     oH=dh, oD=dd, oA=da, o25=r["o25"], btts=r["btts"]))

df = pd.DataFrame(rows)

print("=" * 118)
print("MODEL vs MARKET  (market = devigged book odds via Forebet; edge in pp = model prob - market prob)")
print("=" * 118)
hdr = (f"{'Fixture':<32}{'Mkt H/D/A':<17}{'Model H/D/A':<17}{'Mkt pick':<14}{'Model pick':<14}{'Best edge':>10}{'Best EV':>9}")
print(hdr)
print("-" * 118)
for _, r in df.iterrows():
    mp = max(r["mH"], r["mD"], r["mA"])
    xp = max(r["xH"], r["xD"], r["xA"])
    mlab = ["H", "D", "A"][["mH", "mD", "mA"].index(max(["mH", "mD", "mA"], key=lambda c: r[c]))]
    xlab = ["H", "D", "A"][["xH", "xD", "xA"].index(max(["xH", "xD", "xA"], key=lambda c: r[c]))]
    edges = [("H", r["dH"], r["evH"], r["oH"]), ("D", r["dD"], r["evD"], r["oD"]), ("A", r["dA"], r["evA"], r["oA"])]
    edges.sort(key=lambda e: e[1], reverse=True)
    lab, d, ev, o = edges[0]
    print(f"{r['fixture']:<32}"
          f"{r['mH']*100:>4.0f}/{r['mD']*100:>4.0f}/{r['mA']*100:>4.0f}   "
          f"{r['xH']*100:>4.0f}/{r['xD']*100:>4.0f}/{r['xA']*100:>4.0f}   "
          f"{mlab:<14}{xlab:<14}{d*100:>+8.1f}pp{ev*100:>+8.1f}%")

print()
print("=" * 118)
print("VALUE SIGNALS — model prob - market prob >= +3.0pp  (candidate value bets)")
print("=" * 118)
cands = []
for _, r in df.iterrows():
    for lab, dcol, evcol, ocol in (("H", "dH", "evH", "oH"), ("D", "dD", "evD", "oD"), ("A", "dA", "evA", "oA")):
        if r[dcol] >= 0.03:
            cands.append((r[dcol], r, lab))
cands.sort(key=lambda c: -c[0])
for d, r, lab in cands:
    o = r[{"H": "oH", "D": "oD", "A": "oA"}[lab]]
    ev = r[{"H": "evH", "D": "evD", "A": "evA"}[lab]]
    side = r["home"] if lab == "H" else "Draw" if lab == "D" else r["away"]
    mpct = r[["mH", "mD", "mA"][["H", "D", "A"].index(lab)]]
    xpct = r[["xH", "xD", "xA"][["H", "D", "A"].index(lab)]]
    print(f"{r['league']:<15} {r['fixture']:<32} {side:<14} @ {o:>5.2f}  model {xpct*100:4.1f}% vs mkt {mpct*100:4.1f}%  edge {d*100:+4.1f}pp  EV {ev*100:+5.1f}%")

# agreement stats
agree = 0
for _, r in df.iterrows():
    mp = max(["H", "D", "A"], key=lambda c: r["m" + c])
    xp = max(["H", "D", "A"], key=lambda c: r["x" + c])
    agree += (mp == xp)
print(f"\nModel & market agree on the top outcome in {agree}/{len(df)} fixtures ({agree/len(df)*100:.0f}%)")
mean_abs = df[["dH", "dD", "dA"]].abs().values.sum(axis=1)
print(f"Mean |model - market| summed over 3 outcomes: {mean_abs.mean()*100:.1f}pp")
df.to_csv("value_analysis.csv", index=False)
print("Saved -> value_analysis.csv")
