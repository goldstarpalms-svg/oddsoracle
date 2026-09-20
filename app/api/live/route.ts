import { NextResponse } from "next/server";
import SNAPSHOT from "@/lib/data-snapshot.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// league display name (snapshot) -> ESPN soccer league
const ESPN: Record<string, string> = {
  "Premier League": "eng.1",
  Championship: "eng.2",
  "La Liga": "esp.1",
  "LaLiga 2": "esp.2",
  "Serie A": "ita.1",
  "Serie B": "ita.2",
  "Ligue 1": "fra.1",
  Bundesliga: "ger.1",
  Eredivisie: "ned.1",
  "Scottish Prem": "sco.1",
  "Super Lig": "tur.1",
};

const UA = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function close(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const la = a.length, lb = b.length;
  let common = 0;
  const sa = new Set(a.split("-").filter(Boolean));
  for (const t of b.split("-").filter(Boolean)) if (sa.has(t)) common += t.length + 1;
  return (2 * common) / (la + lb) >= 0.6;
}

let cache: { at: number; body: any } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 60000) {
    return NextResponse.json(cache.body);
  }
  const snap: any = SNAPSHOT as any;
  const football: any[] = snap.football || [];
  const date = String(snap.dataDate || "").replace(/-/g, "");
  const rows = football.filter((r) => r.lg && ESPN[r.lg]);

  // ---- ESPN scoreboards (score / status / clock) --------------------------
  const leagues = Array.from(new Set(rows.map((r) => ESPN[r.lg])));
  const events: any[] = [];
  await Promise.all(
    leagues.map(async (lg) => {
      try {
        const res = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${date}`,
          { headers: UA, cache: "no-store" },
        );
        if (!res.ok) return;
        const d = await res.json();
        events.push(...(d.events || []));
      } catch {
        /* league skipped */
      }
    }),
  );

  const byKey: Record<string, any> = {};
  for (const e of events) {
    const c = e.competitions?.[0];
    if (!c) continue;
    const home = c.competitors?.find((x: any) => x.homeAway === "home");
    const away = c.competitors?.find((x: any) => x.homeAway === "away");
    if (!home || !away) continue;
    const st = c.status?.type || {};
    byKey[`${norm(home.team?.shortDisplayName)}|${norm(away.team?.shortDisplayName)}`] = {
      state: st.state, // pre | in | break | post
      shortDetail: st.shortDetail,
      clock: c.displayClock || null,
      homeScore: Number(home.score || 0),
      awayScore: Number(away.score || 0),
      venue: c.venue?.fullName || null,
    };
  }

  // ---- board rows ------------------------------------------------------------
  const out: any[] = [];
  const toRefresh: { idx: number; url: string }[] = [];
  rows.forEach((r, idx) => {
    const hk = norm(r.home), ak = norm(r.away);
    let live: any = null;
    for (const [k, v] of Object.entries(byKey)) {
      const [eh, ea] = k.split("|");
      if (close(eh, hk) && close(ea, ak)) {
        live = v;
        break;
      }
    }
    const st = live?.state || "pre";
    const inPlay = st === "in" || st === "break";
    let odds = r.oc
      ? { h: r.oc.h, x: r.oc.x, a: r.oc.a, nBooks: r.oc.nBooks, feedTs: r.oc.feedTs, live: false }
      : null;
    if (inPlay && r.oc?.ocUrl) toRefresh.push({ idx, url: r.oc.ocUrl });
    out.push({ __idx: idx, __odds: odds, __st: st, __live: live, __row: r });
  });

  // ---- live odds refresh (parallel, in-play only, capped at 8) ---------------
  await Promise.all(
    toRefresh.slice(0, 8).map(async ({ idx, url }) => {
      try {
        const res = await fetch(url, { headers: UA, cache: "no-store" });
        if (!res.ok) return;
        const html = await res.text();
        const m = html.match(/<!--(\{[\s\S]*?"bestOdds"[\s\S]*?\})-->/);
        if (!m) return;
        const d = JSON.parse(m[1]);
        const bo = d.bestOdds || {};
        const mkts: any = {};
        for (const mm of Object.values<any>(bo.markets?.entities || {}))
          mkts[mm.ocMarketId] = mm.marketTypeName;
        const nonDraw: any[] = [];
        let x: number | null = null;
        for (const b of Object.values<any>(bo.bets?.entities || {})) {
          if (mkts[b.marketId] !== "Win Market") continue;
          const per = bo.odds?.[String(b.ocBetId)] || {};
          const vals = Object.values<any>(per)
            .filter((o) => o.oddsDecimal && o.status === "ACTIVE")
            .map((o) => o.oddsDecimal);
          if (!vals.length) continue;
          if (String(b.betName).trim().toLowerCase() === "draw") x = Math.max(...vals);
          else nonDraw.push(Math.max(...vals));
        }
        const feedTs = Object.values<any>(bo.odds || {})
          .flatMap((per: any) => Object.values<any>(per).map((o: any) => o.betFeedTimestamp))
          .filter(Boolean)
          .sort()
          .pop();
        const prev = out[idx].__odds || {};
        out[idx].__odds = {
          h: nonDraw[0] ?? prev.h,
          x: x ?? prev.x,
          a: nonDraw[1] ?? prev.a,
          nBooks: prev.nBooks,
          feedTs: feedTs || prev.feedTs,
          live: true,
        };
      } catch {
        /* keep bundled odds */
      }
    }),
  );

  const final: any[] = [];
  for (const o of out) {
    const r = o.__row as any;
    const live = o.__live as any;
    const st = o.__st as string;
    const orcl: any = r.oracle || {};
    final.push({
      key: `${r.home}|${r.away}`,
      home: r.home,
      away: r.away,
      league: r.lg,
      kickoff: r.t || null,
      state: st,
      shortDetail: live?.shortDetail || (st === "pre" ? "Not started" : st === "post" ? "Full time" : ""),
      clock: live?.clock || null,
      homeScore: live?.homeScore ?? null,
      awayScore: live?.awayScore ?? null,
      venue: live?.venue || null,
      odds: o.__odds,
      model: orcl.model_probability || null,
      pick: orcl.selection || null,
      signal: orcl.signal || null,
      edge: orcl.edge ?? null,
      oracleScore: orcl.oracle_score ?? null,
      ocUrl: r.oc?.ocUrl || null,
    });
  }

  final.sort((a, b) => {
    const rank = (s: string) => (s === "in" || s === "break" ? 0 : s === "post" ? 2 : 1);
    return rank(a.state) - rank(b.state) || String(a.kickoff || "").localeCompare(String(b.kickoff || ""));
  });

  const body = {
    ok: true,
    ts: new Date().toISOString(),
    dataDate: snap.dataDate,
    nInPlay: final.filter((g) => g.state === "in" || g.state === "break").length,
    games: final,
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
