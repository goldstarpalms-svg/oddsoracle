"""
Extended Poisson model — 6 additional leagues (E1, I2, SP2, NL1, SC0, TR1)
Reuses model.py functions. Fixtures + market odds (American) from forebet 18 Sep 2026.
"""
import pandas as pd
import numpy as np
import model as M

pd.set_option("display.width", 250)


def american_to_dec(o):
    return 1 + o / 100 if o > 0 else 1 + 100 / abs(o)

LEAGUES2 = {
    "E1": "Championship", "I2": "Serie B", "SP2": "LaLiga 2",
    "NL1": "Eredivisie", "SC0": "Scottish Prem", "TR1": "Super Lig",
}

FIXTURES2 = {
    "E1": [("Bristol City", "Watford"), ("Stoke", "Sheffield United"), ("Millwall", "West Ham"),
           ("Cardiff", "Charlton"), ("Wrexham", "Southampton"), ("QPR", "Preston"),
           ("Portsmouth", "Blackburn"), ("Lincoln", "Swansea"), ("Burnley", "Derby"),
           ("Birmingham", "Middlesbrough"), ("Wolves", "West Brom"), ("Norwich", "Bolton")],
    "I2": [("Juve Stabia", "Cesena"), ("Palermo", "Padova"), ("Cremonese", "Virtus Entella"),
           ("Carrarese", "Benevento"), ("Sampdoria", "Catanzaro"), ("Ascoli", "Avellino"),
           ("Verona", "Vicenza"), ("Arezzo", "Sudtirol"), ("Mantova", "Pisa"), ("Modena", "Empoli")],
    "SP2": [("Albacete", "Cordoba"), ("Sociedad B", "Mallorca"), ("Andorra", "Sp Gijon"),
            ("Eldense", "Eibar"), ("Castellon", "Tenerife"), ("Cadiz", "Girona"),
            ("Sabadell", "Oviedo"), ("Ceuta", "Valladolid"), ("Las Palmas", "Burgos"),
            ("Almeria", "Celta B"), ("Leganes", "Granada")],
    "NL1": [("Groningen", "Zwolle"), ("Den Haag", "Cambuur"), ("Sparta Rotterdam", "Heerenveen"),
            ("Ajax", "Excelsior"), ("Willem II", "For Sittard"), ("Feyenoord", "Utrecht"),
            ("AZ Alkmaar", "Telstar"), ("Twente", "PSV Eindhoven"), ("Nijmegen", "Go Ahead Eagles")],
    "SC0": [("St Mirren", "Dundee United"), ("St Johnstone", "Falkirk"), ("Hibernian", "Aberdeen"),
            ("Dundee", "Motherwell"), ("Kilmarnock", "Hearts"), ("Celtic", "Rangers")],
    "TR1": [("Kasimpasa", "Konyaspor"), ("Kocaelispor", "Gaziantep"), ("Corum", "Alanyaspor"),
            ("Buyuksehyr", "Genclerbirligi"), ("Trabzonspor", "Galatasaray"), ("Erzurumspor", "Samsunspor"),
            ("Fenerbahce", "Eyupspor"), ("Goztep", "Rizespor"), ("Amedspor", "Besiktas")],
}

MKT2 = {  # American odds (home, draw, away)
    "E1": {("Bristol City", "Watford"): (-118, 260, 300), ("Stoke", "Sheffield United"): (140, 240, 180),
           ("Millwall", "West Ham"): (300, 290, -125), ("Cardiff", "Charlton"): (-133, 290, 333),
           ("Wrexham", "Southampton"): (200, 260, 125), ("QPR", "Preston"): (-133, 270, 350),
           ("Portsmouth", "Blackburn"): (110, 230, 260), ("Lincoln", "Swansea"): (180, 230, 150),
           ("Burnley", "Derby"): (-125, 260, 333), ("Birmingham", "Middlesbrough"): (180, 260, 135),
           ("Wolves", "West Brom"): (-125, 270, 333), ("Norwich", "Bolton"): (-189, 333, 450)},
    "I2": {("Juve Stabia", "Cesena"): (125, 210, 240), ("Palermo", "Padova"): (-175, 290, 450),
           ("Cremonese", "Virtus Entella"): (-125, 230, 375), ("Carrarese", "Benevento"): (190, 230, 140),
           ("Sampdoria", "Catanzaro"): (100, 230, 270), ("Ascoli", "Avellino"): (110, 230, 250),
           ("Verona", "Vicenza"): (-111, 240, 320), ("Arezzo", "Sudtirol"): (125, 210, 240),
           ("Mantova", "Pisa"): (170, 220, 160), ("Modena", "Empoli"): (-152, 260, 425)},
    "SP2": {("Albacete", "Cordoba"): (135, 260, 180), ("Sociedad B", "Mallorca"): (290, 240, -105),
            ("Andorra", "Sp Gijon"): (100, 250, 260), ("Eldense", "Eibar"): (200, 220, 137),
            ("Castellon", "Tenerife"): (-182, 300, 475), ("Cadiz", "Girona"): (275, 250, -105),
            ("Sabadell", "Oviedo"): (135, 200, 230), ("Ceuta", "Valladolid"): (162, 225, 162),
            ("Las Palmas", "Burgos"): (100, 240, 275), ("Almeria", "Celta B"): (-250, 350, 700),
            ("Leganes", "Granada"): (100, 210, 310)},
    "NL1": {("Groningen", "Zwolle"): (-167, 333, 400), ("Den Haag", "Cambuur"): (-125, 290, 320),
            ("Sparta Rotterdam", "Heerenveen"): (150, 275, 160), ("Ajax", "Excelsior"): (-455, 600, 1000),
            ("Willem II", "For Sittard"): (155, 275, 155), ("Feyenoord", "Utrecht"): (-357, 475, 850),
            ("AZ Alkmaar", "Telstar"): (-400, 500, 900), ("Twente", "PSV Eindhoven"): (187, 300, 120),
            ("Nijmegen", "Go Ahead Eagles"): (-105, 300, 250)},
    "SC0": {("St Mirren", "Dundee United"): (135, 260, 187), ("St Johnstone", "Falkirk"): (105, 250, 250),
            ("Hibernian", "Aberdeen"): (-139, 280, 350), ("Dundee", "Motherwell"): (200, 250, 125),
            ("Kilmarnock", "Hearts"): (375, 310, -154), ("Celtic", "Rangers"): (120, 270, 200)},
    "TR1": {("Kasimpasa", "Konyaspor"): (135, 220, 200), ("Kocaelispor", "Gaziantep"): (120, 210, 240),
            ("Corum", "Alanyaspor"): (110, 220, 250), ("Buyuksehyr", "Genclerbirligi"): (-222, 333, 550),
            ("Trabzonspor", "Galatasaray"): (200, 270, 110), ("Erzurumspor", "Samsunspor"): (162, 220, 162),
            ("Fenerbahce", "Eyupspor"): (-556, 550, 1200), ("Goztep", "Rizespor"): (135, 240, 180),
            ("Amedspor", "Besiktas"): (290, 260, -120)},
}


def main():
    print("=" * 104)
    print("STAGE 1 — BACKTEST + SHRINKAGE TUNING (fit 24/25 goals -> predict 25/26), 6 new leagues")
    print("=" * 104)
    tuned = {}
    for lg in LEAGUES2:
        w, res, n, *_ = M.backtest(lg)
        tuned[lg] = w
        print(f"{LEAGUES2[lg]:<14} n={n}  best w={w:.2f}")

    print()
    print("=" * 104)
    print("STAGE 2 — WEEKEND PREDICTIONS (60 fixtures) + MARKET VALUE (American odds, devigged)")
    print("=" * 104)
    rows, vrows = [], []
    for lg in LEAGUES2:
        s_live, Ah, Aa, s25, s26, w26 = M.live_strengths(lg)
        w = tuned[lg]
        print(f"\n### {LEAGUES2[lg]:<14} (avg xG/match home {Ah:.2f} / away {Aa:.2f}; w={w:.2f}; "
              f"26/27 weight {w26.mean()*100:.0f}%)")
        for home, away in FIXTURES2[lg]:
            p, o25, btts, mm = M.match_probs(s_live, Ah, Aa, home, away, w)
            ph, pd_, pa = p
            mkt = MKT2[lg][(home, away)]
            dec = [american_to_dec(o) for o in mkt]
            imp = [1 / d for d in dec]
            sv = sum(imp)
            mdev = [x / sv for x in imp]  # devigged market probs
            mp, md, ma = mdev
            rows.append(dict(league=LEAGUES2[lg], home=home, away=away,
                             ph=ph, pd=pd_, pa=pa, o25=o25, btts=btts,
                             mkt_h=mkt[0], mkt_d=mkt[1], mkt_a=mkt[2],
                             mph=mp, mpd=md, mpa=ma))
            dev = [mp, md, ma]
            for i, lab in enumerate(("H", "D", "A")):
                pm, decv, mktv = p[i], dec[i], mkt[i]
                vrows.append(dict(league=LEAGUES2[lg], home=home, away=away, outcome=lab,
                                  prob=pm, odds=decv, mkt=mktv, edge=pm - (1 / decv),
                                  dev_edge=pm - dev[i], ev=(pm * decv - 1) * 100))
            print(f"  {home+' v '+away:<32} H {ph*100:5.1f}%  D {pd_*100:5.1f}%  A {pa*100:5.1f}%   "
                  f"(mkt devig {mp*100:5.1f}/{md*100:5.1f}/{ma*100:5.1f})")
    pred = pd.DataFrame(rows)
    pred.to_csv("predictions_weekend2.csv", index=False)
    val = pd.DataFrame(vrows)
    val.to_csv("value2.csv", index=False)

    print("\n" + "=" * 104)
    print("STAGE 3 — TOP VALUE CANDIDATES (edge = model prob - devigged market prob, >= 3pp)")
    print("=" * 104)
    top = val[val["dev_edge"] >= 0.03].sort_values("dev_edge", ascending=False).head(20)
    for _, r in top.iterrows():
        tname = {"H": r["home"], "D": "Draw", "A": r["away"]}[r["outcome"]]
        print(f"{r['league']:<14} {r['home']+' v '+r['away']:<34} {tname:<16} "
              f"mod {r['prob']*100:5.1f}%  mkt {r['mkt']:>6} ({1/r['odds']*100:5.1f}%)  "
              f"edge {r['dev_edge']*100:+5.1f}pp  EV {r['ev']:+6.1f}%")
    print("\nSaved -> predictions_weekend2.csv, value2.csv")


if __name__ == "__main__":
    main()
