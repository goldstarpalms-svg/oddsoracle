"""
Build daily prediction JSON files for the Naija Daily Picks app.

Sources:
  1. My Poisson model for the 11 covered leagues (model.py + model2.py,
     fixtures + American market odds already recorded).
  2. Forebet market view for "other leagues" (fetched via the assistant's
     web fetcher; forebet blocks direct sandbox connections).

Output: daily/YYYY-MM-DD.json  (one per date) + app_meta.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pandas as pd
import numpy as np
import model as M
import model2 as M2

HERE = os.path.dirname(os.path.abspath(__file__))
DAILY_DIR = os.path.join(HERE, "daily")

# date -> list of (home, away) per covered league, taken from the recorded
# forebet rounds (weekend of 18-21 Sep 2026)
WEEKEND = {
    "2026-09-18": {
        "E1": [("Bristol City", "Watford")],
        "I2": [("Juve Stabia", "Cesena")],
        "SP2": [("Albacete", "Cordoba")],
        "NL1": [("Groningen", "Zwolle")],
        "TR1": [("Kasimpasa", "Konyaspor")],
    },
    "2026-09-19": {
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
        "I1": [("Bologna", "Torino"), ("Udinese", "Cagliari"), ("Roma", "Inter"),
               ("Venezia", "Lazio"), ("Fiorentina", "Napoli"), ("Frosinone", "Como"),
               ("Parma", "Genoa"), ("Juventus", "Atalanta"), ("Milan", "Lecce")],
        "F1": [("Monaco", "Lens"), ("Angers", "Troyes"), ("Auxerre", "Brest"),
               ("Le Mans", "Lorient"), ("Lyon", "Rennes"), ("Marseille", "Paris SG"),
               ("Nice", "Lille"), ("Paris FC", "Strasbourg"), ("Toulouse", "Le Havre")],
        "E1": [("Stoke", "Sheffield United"), ("Millwall", "West Ham"), ("Cardiff", "Charlton"),
               ("Wrexham", "Southampton"), ("QPR", "Preston"), ("Portsmouth", "Blackburn"),
               ("Lincoln", "Swansea"), ("Burnley", "Derby"), ("Birmingham", "Middlesbrough")],
        "I2": [("Palermo", "Padova"), ("Cremonese", "Virtus Entella"), ("Carrarese", "Benevento"),
               ("Sampdoria", "Catanzaro"), ("Ascoli", "Avellino")],
        "SP2": [("Sociedad B", "Mallorca"), ("Andorra", "Sp Gijon"), ("Eldense", "Eibar"),
                ("Castellon", "Tenerife"), ("Cadiz", "Girona")],
        "NL1": [("Den Haag", "Cambuur"), ("Sparta Rotterdam", "Heerenveen"), ("Ajax", "Excelsior"),
                ("Willem II", "For Sittard")],
        "SC0": [("St Mirren", "Dundee United"), ("St Johnstone", "Falkirk"), ("Hibernian", "Aberdeen"),
                ("Dundee", "Motherwell"), ("Kilmarnock", "Hearts")],
        "TR1": [("Kocaelispor", "Gaziantep"), ("Corum", "Alanyaspor"), ("Buyuksehyr", "Genclerbirligi"),
                ("Trabzonspor", "Galatasaray")],
    },
    "2026-09-20": {
        "E1": [("Wolves", "West Brom"), ("Norwich", "Bolton")],
        "I2": [("Verona", "Vicenza"), ("Arezzo", "Sudtirol"), ("Mantova", "Pisa"), ("Modena", "Empoli")],
        "SP2": [("Sabadell", "Oviedo"), ("Ceuta", "Valladolid"), ("Las Palmas", "Burgos"),
                ("Almeria", "Celta B"), ("Leganes", "Granada")],
        "NL1": [("Feyenoord", "Utrecht"), ("AZ Alkmaar", "Telstar"), ("Twente", "PSV Eindhoven"),
                ("Nijmegen", "Go Ahead Eagles")],
        "SC0": [("Celtic", "Rangers")],
        "TR1": [("Erzurumspor", "Samsunspor"), ("Fenerbahce", "Eyupspor"), ("Goztep", "Rizespor"),
                ("Amedspor", "Besiktas")],
    },
    "2026-09-21": {},
}

# kickoff times (WAT = UTC+1, Lagos) for the model games
KICKOFFS = {
    ("Bristol City", "Watford"): "15:00", ("Juve Stabia", "Cesena"): "15:30",
    ("Albacete", "Cordoba"): "15:30", ("Groningen", "Zwolle"): "15:00",
    ("Kasimpasa", "Konyaspor"): "14:00",
    ("Stoke", "Sheffield United"): "12:00", ("Millwall", "West Ham"): "12:00",
    ("Cardiff", "Charlton"): "12:00", ("Wrexham", "Southampton"): "12:00",
    ("QPR", "Preston"): "12:00", ("Portsmouth", "Blackburn"): "12:00",
    ("Lincoln", "Swansea"): "12:00", ("Burnley", "Derby"): "12:00",
    ("Birmingham", "Middlesbrough"): "12:00", ("Wolves", "West Brom"): "14:30",
    ("Norwich", "Bolton"): "14:30",
    ("Palermo", "Padova"): "11:00", ("Cremonese", "Virtus Entella"): "11:00",
    ("Carrarese", "Benevento"): "11:00", ("Sampdoria", "Catanzaro"): "13:15",
    ("Ascoli", "Avellino"): "15:30", ("Verona", "Vicenza"): "11:00",
    ("Arezzo", "Sudtirol"): "11:00", ("Mantova", "Pisa"): "13:15", ("Modena", "Empoli"): "15:30",
    ("Sociedad B", "Mallorca"): "10:00", ("Andorra", "Sp Gijon"): "12:15",
    ("Eldense", "Eibar"): "14:30", ("Castellon", "Tenerife"): "14:30",
    ("Cadiz", "Girona"): "15:00", ("Sabadell", "Oviedo"): "10:00",
    ("Ceuta", "Valladolid"): "12:15", ("Las Palmas", "Burgos"): "14:30",
    ("Almeria", "Celta B"): "14:30", ("Leganes", "Granada"): "15:00",
    ("Den Haag", "Cambuur"): "12:30", ("Sparta Rotterdam", "Heerenveen"): "14:45",
    ("Ajax", "Excelsior"): "16:00", ("Willem II", "For Sittard"): "17:00",
    ("Feyenoord", "Utrecht"): "08:15", ("AZ Alkmaar", "Telstar"): "10:30",
    ("Twente", "PSV Eindhoven"): "10:30", ("Nijmegen", "Go Ahead Eagles"): "12:45",
    ("St Mirren", "Dundee United"): "12:00", ("St Johnstone", "Falkirk"): "12:00",
    ("Hibernian", "Aberdeen"): "12:00", ("Dundee", "Motherwell"): "12:00",
    ("Kilmarnock", "Hearts"): "12:00", ("Celtic", "Rangers"): "09:00",
    ("Kocaelispor", "Gaziantep"): "12:00", ("Corum", "Alanyaspor"): "12:00",
    ("Buyuksehyr", "Genclerbirligi"): "14:00", ("Trabzonspor", "Galatasaray"): "14:00",
    ("Erzurumspor", "Samsunspor"): "12:00", ("Fenerbahce", "Eyupspor"): "12:00",
    ("Goztep", "Rizespor"): "14:00", ("Amedspor", "Besiktas"): "14:00",
}

def main():
    # ---- compute model rows once per league ----
    tuned = {}
    live = {}
    for lg in M.LEAGUES:
        w, *_ = M.backtest(lg)
        tuned[lg] = w
        live[lg] = M.live_strengths(lg)
    for lg in M2.LEAGUES2:
        w, *_ = M.backtest(lg)
        tuned[lg] = w
        live[lg] = M.live_strengths(lg)

    def model_row(lg, home, away):
        s_live, Ah, Aa, *_ = live[lg]
        w = tuned[lg]
        p, o25, btts, mm = M.match_probs(s_live, Ah, Aa, home, away, w)
        ph, pd_, pa = p
        i, j = np.indices(mm.shape)
        tot, diff = i + j, i - j
        o15 = mm[tot >= 2].sum(); o35 = mm[tot >= 4].sum()
        ah_h = mm[diff >= 2].sum() + 0.5 * mm[diff == 1].sum()
        dc1x, dcx2, dc12 = ph + pd_, pd_ + pa, ph + pa
        dnbh, dnba = ph / (ph + pa), pa / (ph + pa)
        lab = "1" if ph >= max(pd_, pa) else ("X" if pd_ >= max(ph, pa) else "2")
        flat = mm.flatten()
        idx = np.argsort(flat)[::-1][:2]
        cs = [f"{x // len(mm)}-{x % len(mm)}" for x in idx]
        top_p = max(ph, pd_, pa)
        bank = "BANKER" if top_p >= 0.60 else ("SAFE" if top_p >= 0.55
                else ("MODERATE" if top_p >= 0.48 else "RISKY"))
        return dict(p1=float(ph), px=float(pd_), p2=float(pa),
                    fair1=1/ph, fairX=1/pd_, fair2=1/pa,
                    pick=lab, o15=float(o15), o25=float(o25), o35=float(o35),
                    btts=float(btts), no_btts=float(1-btts),
                    dc1x=float(dc1x), dcx2=float(dcx2), dc12=float(dc12),
                    dnbH=float(dnbh), dnbA=float(dnba),
                    ah_h_minus1=float(ah_h), ah_h_plus1=float(1-ah_h),
                    cs1=cs[0], cs2=cs[1], bank=bank)

    def am2d(o):
        return 1 + o / 100 if o > 0 else 1 + 100 / abs(o)

    os.makedirs(DAILY_DIR, exist_ok=True)
    meta = {"dates": [], "generated_at": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
            "covered_leagues": list(M.LEAGUES.values()) + list(M2.LEAGUES2.values())}

    for date, fixtures in WEEKEND.items():
        games = []
        for lg, pairs in fixtures.items():
            for home, away in pairs:
                row = dict(league=(M.LEAGUES.get(lg) or M2.LEAGUES2[lg]), league_code=lg,
                           home=home, away=away, date=date,
                           kickoff=KICKOFFS.get((home, away), ""),
                           covered=True, model=model_row(lg, home, away))
                key = (home, away)
                odds = M2.MKT2.get(lg, {}).get(key)
                if odds is None:
                    # top-5 leagues: odds live in value.py MARKET keyed "home v away"
                    import value as V
                    odds = V.MARKET.get(f"{home} v {away}")
                if odds:
                    oh, od, oa = odds
                    dec = [am2d(x) for x in odds]
                    imp = [1/d for d in dec]
                    sv = sum(imp)
                    row.update(mkt=[oh, od, oa], mkt_dec=dec,
                               mkt_devig=[imp[0]/sv, imp[1]/sv, imp[2]/sv],
                               edge=[row["model"][k] - imp[i]/sv
                                     for i, k in enumerate(("p1", "px", "p2"))])
                games.append(row)
        games.sort(key=lambda g: (g["kickoff"] or "99:99"))
        out = dict(date=date, games=games,
                   n_model=len(games))
        with open(os.path.join(DAILY_DIR, f"{date}.json"), "w") as f:
            json.dump(out, f, indent=1)
        meta["dates"].append(date)
        print(f"{date}: {len(games)} model games")

    # ---- other leagues (forebet market view, fetched 18 Sep, times shown as
    # forebet displays them; WAT = displayed time + 5h during US daylight) ----
    OTHER = json.load(open(os.path.join(HERE, "other_2026_09_18.json")))
    today_path = os.path.join(DAILY_DIR, "2026-09-18.json")
    today = json.load(open(today_path))
    today["other_games"] = OTHER
    today["n_other"] = len(OTHER)
    json.dump(today, open(today_path, "w"), indent=1)
    print(f"2026-09-18: +{len(OTHER)} other-league games")

    json.dump(meta, open(os.path.join(HERE, "app_meta.json"), "w"), indent=1)
    print("done ->", DAILY_DIR)


if __name__ == "__main__":
    main()
