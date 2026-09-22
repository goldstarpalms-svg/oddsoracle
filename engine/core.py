"""
OddsOracle engine v2 — data loading, features and model.

Design rules (non-negotiable):
  1. The model never sees the market price as an input. A model that ingests
     price can only restate it; the edge has to come from match data.
  2. Strengths are estimated from shots on target as well as goals. SoT is
     ~3x more frequent than goals, so ratings stabilise with fewer matches —
     the closest thing to xG that three seasons of CSVs can support.
  3. Anything not validated walk-forward is not claimed.
"""
from __future__ import annotations

import glob
import math
import os
import re
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln

DATA_DIR = os.environ.get("OO_DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "backend", "data"))

# League files carry either football-data.co.uk codes (E0, SP1) or display
# names (Premier League). Map them onto one code per competition.
LEAGUE_FILES = {
    "E0": "Premier League", "E1": "Championship", "SP1": "La Liga", "SP2": "LaLiga 2",
    "I1": "Serie A", "I2": "Serie B", "D1": "Bundesliga", "F1": "Ligue 1",
    "NL1": "Eredivisie", "TR1": "Super Lig", "SC0": "Scottish Prem", "RO1": "Romania",
    "NG1": "Nigeria", "P1": "Primeira Liga",
}


def canon(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())[:24]


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------
def load_matches(data_dir: str = DATA_DIR) -> pd.DataFrame:
    """Every played match we have, with goals, shots and closing odds."""
    rows = []
    for path in sorted(glob.glob(os.path.join(data_dir, "*.csv"))):
        name = os.path.basename(path)
        if name.endswith(".bak") or "_live" in name:
            continue
        m = re.match(r"^(2425|2526|2627)_(.+)\.csv$", name)
        if not m:
            continue
        season, raw_league = m.group(1), m.group(2)
        try:
            df = pd.read_csv(path, encoding="latin-1")
        except Exception:
            continue
        needed = {"Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"}
        if not needed.issubset(df.columns):
            continue
        keep = ["Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"]
        for c in ("HS", "AS", "HST", "AST", "HC", "AC", "B365H", "B365D", "B365A"):
            if c in df.columns:
                keep.append(c)
        d = df[keep].copy()
        d["Date"] = pd.to_datetime(d["Date"], format="%d/%m/%Y", errors="coerce")
        if d["Date"].isna().all():
            d["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        d = d.dropna(subset=["Date", "HomeTeam", "AwayTeam", "FTHG", "FTAG"])
        for c in keep:
            if c not in ("Date", "HomeTeam", "AwayTeam"):
                d[c] = pd.to_numeric(d[c], errors="coerce")
        d["league"] = raw_league
        d["season"] = season
        rows.append(d)

    if not rows:
        return pd.DataFrame()
    out = pd.concat(rows, ignore_index=True)

    # one row per (league, date, teams) — the same competition appears under
    # both its code and its display name in different seasons
    out["key"] = out["league"].map(str) + "|" + out["Date"].dt.strftime("%Y-%m-%d") + "|" + \
        out["HomeTeam"].map(canon) + "|" + out["AwayTeam"].map(canon)
    out = out.drop_duplicates(subset=["key"]).drop(columns=["key"])

    out["home"] = out["HomeTeam"].map(canon)
    out["away"] = out["AwayTeam"].map(canon)
    out = out.sort_values("Date").reset_index(drop=True)
    return out


# --------------------------------------------------------------------------
# Features — built strictly from matches BEFORE the one being predicted
# --------------------------------------------------------------------------
@dataclass
class TeamState:
    goals_for: float = 0.0
    goals_against: float = 0.0
    sot_for: float = 0.0
    sot_against: float = 0.0
    n: int = 0


def rolling_features(df: pd.DataFrame, window: int = 8, decay: float = 0.92) -> pd.DataFrame:
    """Exponentially-decayed rolling team form, computed with no look-ahead."""
    state: dict[tuple[str, str], TeamState] = {}
    recs = []

    for _, r in df.iterrows():
        lg, h, a = r["league"], r["home"], r["away"]
        sh = state.get((lg, h), TeamState())
        sa = state.get((lg, a), TeamState())

        recs.append({
            "h_gf": sh.goals_for, "h_ga": sh.goals_against,
            "a_gf": sa.goals_for, "a_ga": sa.goals_against,
            "h_sotf": sh.sot_for, "h_sota": sh.sot_against,
            "a_sotf": sa.sot_for, "a_sota": sa.sot_against,
            "h_n": sh.n, "a_n": sa.n,
        })

        # update AFTER recording — the match being predicted never sees itself
        gh, ga = r["FTHG"], r["FTAG"]
        sh = TeamState(sh.goals_for * decay + gh, sh.goals_against * decay + ga,
                       sh.sot_for, sh.sot_against, min(window, sh.n + 1))
        sa = TeamState(sa.goals_for * decay + ga, sa.goals_against * decay + gh,
                       sa.sot_for, sa.sot_against, min(window, sa.n + 1))
        if "HST" in df.columns:
            hst = r.get("HST"); ast = r.get("AST")
            if pd.notna(hst) and pd.notna(ast):
                sh.sot_for = sh.sot_for * decay + float(hst)
                sh.sot_against = sh.sot_against * decay + float(ast)
                sa.sot_for = sa.sot_for * decay + float(ast)
                sa.sot_against = sa.sot_against * decay + float(hst)
        state[(lg, h)] = sh
        state[(lg, a)] = sa

    return pd.DataFrame(recs, index=df.index)


# --------------------------------------------------------------------------
# Model: Dixon-Coles Poisson on goals, blended with a shots-on-target variant
# --------------------------------------------------------------------------
def _fit_att_def(idx_home, idx_away, home_goals, away_goals, weights, n_teams, ridge=0.008):
    """Weighted Poisson MLE for attack/defence + home advantage."""
    def unpack(t):
        return t[0], t[1:1 + n_teams], t[1 + n_teams:1 + 2 * n_teams]

    def nll(t):
        adv, att, dfn = unpack(t)
        lh = np.exp(adv + att[idx_home] + dfn[idx_away])
        la = np.exp(att[idx_away] + dfn[idx_home])
        ll = weights * (home_goals * np.log(lh) - lh - gammaln(home_goals + 1)
                        + away_goals * np.log(la) - la - gammaln(away_goals + 1))
        return -(ll.sum() - ridge * (np.sum(att ** 2) + np.sum(dfn ** 2)))

    x0 = np.concatenate([[0.25], np.zeros(n_teams), np.zeros(n_teams)])
    res = minimize(nll, x0, method="L-BFGS-B",
                   bounds=[(-0.2, 1.0)] + [(-2.5, 2.5)] * (2 * n_teams),
                   options={"maxiter": 300, "maxfun": 20000})
    adv, att, dfn = unpack(res.x)
    return float(adv), att - att.mean(), dfn - dfn.mean()


class PoissonDC:
    """Poisson with Dixon-Coles correction, optionally rating on shots on target."""

    def __init__(self, half_life_days: float = 320.0, sot_weight: float = 0.35):
        self.half_life_days = half_life_days
        self.sot_weight = sot_weight
        self.teams_: dict[str, int] = {}
        self.att_ = None
        self.dfn_ = None
        self.home_adv_ = 0.25
        self.rho_ = -0.05

    def fit(self, df: pd.DataFrame) -> "PoissonDC":
        d = df.dropna(subset=["FTHG", "FTAG"]).copy()
        teams = sorted(set(d["home"]) | set(d["away"]))
        self.teams_ = {t: i for i, t in enumerate(teams)}
        n = len(teams)
        if n < 4 or len(d) < 40:
            self.att_ = self.dfn_ = None
            return self

        ih = d["home"].map(self.teams_).to_numpy()
        ia = d["away"].map(self.teams_).to_numpy()
        hg = d["FTHG"].to_numpy(float)
        ag = d["FTAG"].to_numpy(float)
        age = (d["Date"].max() - d["Date"]).dt.days.clip(lower=0).to_numpy(float)
        w = 0.5 ** (age / self.half_life_days)

        adv, att_g, dfn_g = _fit_att_def(ih, ia, hg, ag, w, n)

        # Second, lower-variance rating from shots on target (when available).
        if "HST" in d.columns and d[["HST", "AST"]].notna().all(axis=1).sum() > 50:
            ds = d.dropna(subset=["HST", "AST"]).copy()
            ihs = ds["home"].map(self.teams_).to_numpy()
            ias = ds["away"].map(self.teams_).to_numpy()
            ages = (ds["Date"].max() - ds["Date"]).dt.days.clip(lower=0).to_numpy(float)
            ws = 0.5 ** (ages / self.half_life_days)
            _, att_s, dfn_s = _fit_att_def(
                ihs, ias, ds["HST"].to_numpy(float), ds["AST"].to_numpy(float), ws, n)
            att = (1 - self.sot_weight) * att_g + self.sot_weight * att_s
            dfn = (1 - self.sot_weight) * dfn_g + self.sot_weight * dfn_s
        else:
            att, dfn = att_g, dfn_g

        self.home_adv_, self.att_, self.dfn_ = adv, att, dfn
        self.rho_ = self._fit_rho(d, ih, ia, w)
        return self

    def _fit_rho(self, d, ih, ia, w):
        lg_h = np.exp(self.home_adv_ + self.att_[ih] + self.dfn_[ia])
        lg_a = np.exp(self.att_[ia] + self.dfn_[ih])
        hg = d["FTHG"].to_numpy(float)
        ag = d["FTAG"].to_numpy(float)

        def nll(rho):
            lh, la = lg_h, lg_a
            ll = w * (hg * np.log(lh) - lh - gammaln(hg + 1)
                      + ag * np.log(la) - la - gammaln(ag + 1))
            # Dixon-Coles tau correction on the four low-score cells
            corr = np.zeros(len(hg))
            m00 = (hg == 0) & (ag == 0)
            m01 = (hg == 0) & (ag == 1)
            m10 = (hg == 1) & (ag == 0)
            m11 = (hg == 1) & (ag == 1)
            corr[m00] = w[m00] * np.log(np.clip(1 - lh[m00] * la[m00] * rho[0], 1e-6, None))
            corr[m01] = w[m01] * np.log(np.clip(1 + lh[m01] * rho[0], 1e-6, None))
            corr[m10] = w[m10] * np.log(np.clip(1 + la[m10] * rho[0], 1e-6, None))
            corr[m11] = w[m11] * np.log(np.clip(1 - rho[0], 1e-6, None))
            return -(ll.sum() + corr.sum())

        res = minimize(nll, np.array([-0.05]), method="L-BFGS-B", bounds=[(-0.35, 0.15)])
        return float(res.x[0])

    def probs(self, home: str, away: str, max_goals: int = 9):
        """(p_home, p_draw, p_away, expected_home_goals, expected_away_goals)"""
        if self.att_ is None or home not in self.teams_ or away not in self.teams_:
            return None
        i, j = self.teams_[home], self.teams_[away]
        lh = float(np.exp(self.home_adv_ + self.att_[i] + self.dfn_[j]))
        la = float(np.exp(self.att_[j] + self.dfn_[i]))
        if not (0.05 < lh < 9 and 0.05 < la < 9):
            return None
        xs = np.arange(max_goals + 1)
        ph = np.exp(-lh) * lh ** xs / np.array([math.factorial(k) for k in xs])
        pa = np.exp(-la) * la ** xs / np.array([math.factorial(k) for k in xs])
        mat = np.outer(ph, pa)
        rho = self.rho_
        for x in (0, 1):
            for y in (0, 1):
                tau = (1 - lh * la * rho) if (x == 0 and y == 0) else \
                      (1 + lh * rho) if (x == 0 and y == 1) else \
                      (1 + la * rho) if (x == 1 and y == 0) else (1 - rho)
                mat[x, y] *= tau
        mat = np.clip(mat, 0, None)
        mat /= mat.sum()
        p_h = float(np.tril(mat, -1).sum())
        p_d = float(np.trace(mat))
        p_a = float(np.triu(mat, 1).sum())
        s = p_h + p_d + p_a
        return p_h / s, p_d / s, p_a / s, lh, la
