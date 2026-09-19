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
        "SP1": [("Espanol", "Elche")],
        "D1": [("Bayern Munich", "Union Berlin")],
        "F1": [("Monaco", "Lens")],
    },
    "2026-09-19": {
        "E0": [("Tottenham", "Aston Villa"), ("Brighton", "Arsenal"), ("Everton", "Ipswich"),
               ("Newcastle", "Hull"), ("Nott'm Forest", "Coventry")],
        "SP1": [("Osasuna", "Vallecano"), ("Ath Bilbao", "Alaves"),
                ("Celta", "Santander"), ("Sevilla", "Barcelona")],
        "D1": [("Ein Frankfurt", "Freiburg"), ("M'gladbach", "Mainz"),
               ("Hamburg", "FC Koln"), ("Werder Bremen", "Augsburg"), ("Stuttgart", "Dortmund")],
        "I1": [("Bologna", "Torino"), ("Udinese", "Cagliari"), ("Roma", "Inter"),
               ("Venezia", "Lazio")],
        "F1": [("Angers", "Troyes"), ("Le Mans", "Lorient"), ("Lyon", "Rennes"),
               ("Paris FC", "Strasbourg"), ("Toulouse", "Le Havre")],
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
        "E0": [("Man City", "Sunderland"), ("Leeds", "Crystal Palace"),
               ("Bournemouth", "Liverpool"), ("Fulham", "Man United")],
        "SP1": [("Getafe", "Malaga"), ("Ath Madrid", "Real Madrid"), ("La Coruna", "Betis"),
                ("Villarreal", "Levante"), ("Valencia", "Sociedad")],
        "D1": [("Leverkusen", "RB Leipzig"), ("Schalke 04", "Elversberg"), ("Paderborn", "Hoffenheim")],
        "I1": [("Fiorentina", "Napoli"), ("Frosinone", "Como"), ("Parma", "Genoa"),
               ("Juventus", "Atalanta"), ("Milan", "Lecce")],
        "F1": [("Auxerre", "Brest"), ("Nice", "Lille"), ("Marseille", "Paris SG")],
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

# kickoff times (WAT = UTC+1, Lagos) for the model games — from forebet, 19/9
KICKOFFS = {
    # Fri 18/9
    ("Bristol City", "Watford"): "15:00", ("Juve Stabia", "Cesena"): "15:30",
    ("Albacete", "Cordoba"): "15:30", ("Groningen", "Zwolle"): "15:00",
    ("Kasimpasa", "Konyaspor"): "14:00", ("Espanol", "Elche"): "20:00",
    ("Bayern Munich", "Union Berlin"): "19:30", ("Monaco", "Lens"): "19:45",
    # Sat 19/9
    ("Tottenham", "Aston Villa"): "12:30", ("Brighton", "Arsenal"): "15:00",
    ("Everton", "Ipswich"): "15:00", ("Newcastle", "Hull"): "15:00",
    ("Nott'm Forest", "Coventry"): "17:30",
    ("Stoke", "Sheffield United"): "12:30", ("Millwall", "West Ham"): "12:30",
    ("Cardiff", "Charlton"): "12:30", ("Wrexham", "Southampton"): "15:00",
    ("QPR", "Preston"): "15:00", ("Portsmouth", "Blackburn"): "15:00",
    ("Lincoln", "Swansea"): "15:00", ("Burnley", "Derby"): "15:00",
    ("Birmingham", "Middlesbrough"): "15:00",
    ("Osasuna", "Vallecano"): "13:00", ("Ath Bilbao", "Alaves"): "15:15",
    ("Celta", "Santander"): "17:30", ("Sevilla", "Barcelona"): "20:00",
    ("Sociedad B", "Mallorca"): "13:00", ("Andorra", "Sp Gijon"): "15:15",
    ("Eldense", "Eibar"): "17:30", ("Castellon", "Tenerife"): "17:30",
    ("Cadiz", "Girona"): "20:00",
    ("Ein Frankfurt", "Freiburg"): "14:30", ("M'gladbach", "Mainz"): "14:30",
    ("Hamburg", "FC Koln"): "14:30", ("Werder Bremen", "Augsburg"): "14:30",
    ("Stuttgart", "Dortmund"): "17:30",
    ("Bologna", "Torino"): "14:00", ("Udinese", "Cagliari"): "14:00",
    ("Roma", "Inter"): "17:00", ("Venezia", "Lazio"): "19:45",
    ("Palermo", "Padova"): "14:00", ("Cremonese", "Virtus Entella"): "14:00",
    ("Carrarese", "Benevento"): "14:00", ("Sampdoria", "Catanzaro"): "16:15",
    ("Ascoli", "Avellino"): "18:30",
    ("Angers", "Troyes"): "19:45", ("Le Mans", "Lorient"): "19:45",
    ("Lyon", "Rennes"): "19:45", ("Paris FC", "Strasbourg"): "16:15",
    ("Toulouse", "Le Havre"): "19:45",
    ("Den Haag", "Cambuur"): "15:30", ("Sparta Rotterdam", "Heerenveen"): "17:45",
    ("Ajax", "Excelsior"): "19:00", ("Willem II", "For Sittard"): "20:00",
    ("St Mirren", "Dundee United"): "15:00", ("St Johnstone", "Falkirk"): "15:00",
    ("Hibernian", "Aberdeen"): "15:00", ("Dundee", "Motherwell"): "15:00",
    ("Kilmarnock", "Hearts"): "17:45",
    ("Kocaelispor", "Gaziantep"): "15:00", ("Corum", "Alanyaspor"): "15:00",
    ("Buyuksehyr", "Genclerbirligi"): "18:00", ("Trabzonspor", "Galatasaray"): "18:00",
    # Sun 20/9
    ("Man City", "Sunderland"): "14:00", ("Leeds", "Crystal Palace"): "14:00",
    ("Bournemouth", "Liverpool"): "14:00", ("Fulham", "Man United"): "16:30",
    ("Getafe", "Malaga"): "13:00", ("Ath Madrid", "Real Madrid"): "15:15",
    ("La Coruna", "Betis"): "17:30", ("Villarreal", "Levante"): "17:30",
    ("Leverkusen", "RB Leipzig"): "14:30", ("Schalke 04", "Elversberg"): "16:30",
    ("Paderborn", "Hoffenheim"): "18:30",
    ("Fiorentina", "Napoli"): "11:30", ("Frosinone", "Como"): "14:00",
    ("Parma", "Genoa"): "14:00", ("Juventus", "Atalanta"): "17:00",
    ("Milan", "Lecce"): "19:45",
    ("Auxerre", "Brest"): "14:00", ("Nice", "Lille"): "16:15",
    ("Marseille", "Paris SG"): "19:45",
    ("Wolves", "West Brom"): "14:30", ("Norwich", "Bolton"): "14:30",
    ("Verona", "Vicenza"): "14:00", ("Arezzo", "Sudtirol"): "14:00",
    ("Mantova", "Pisa"): "16:15", ("Modena", "Empoli"): "18:30",
    ("Sabadell", "Oviedo"): "13:00", ("Ceuta", "Valladolid"): "15:15",
    ("Las Palmas", "Burgos"): "17:30", ("Almeria", "Celta B"): "17:30",
    ("Leganes", "Granada"): "20:00",
    ("Feyenoord", "Utrecht"): "11:15", ("AZ Alkmaar", "Telstar"): "13:30",
    ("Twente", "PSV Eindhoven"): "13:30", ("Nijmegen", "Go Ahead Eagles"): "15:45",
    ("Celtic", "Rangers"): "12:00",
    ("Erzurumspor", "Samsunspor"): "15:00", ("Fenerbahce", "Eyupspor"): "15:00",
    ("Goztep", "Rizespor"): "18:00", ("Amedspor", "Besiktas"): "18:00",
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
