// POST /api/slip-code — MyBetCode booking-code decode (server-side; key never reaches the browser)
// Body: { bookie: "sportybet:ng", code: "ABC123" }
// Returns the decoded slip (selections) so the UI can cross-check it against our model.
export const maxDuration = 30;

type Sel = {
  home_team?: string;
  away_team?: string;
  kickoff_utc?: string;
  competition?: string;
  market?: string;
  specifier?: string;
  pick?: string;
  odds?: number;
  [k: string]: unknown;
};

export async function POST(req: Request) {
  let body: { bookie?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Send a JSON body { bookie, code }." }, { status: 400 });
  }
  const bookie = String(body.bookie || "").trim();
  const code = String(body.code || "").trim();
  if (!bookie || !code) {
    return Response.json({ ok: false, error: "Pick a bookie and paste the booking code." }, { status: 400 });
  }

  const key = process.env.MYBETCODE_KEY;
  if (!key) {
    return Response.json({ ok: false, error: "Booking-code engine not configured yet (server key missing). Ask the admin to set MYBETCODE_KEY on Vercel, then try again." }, { status: 503 });
  }

  const url =
    "https://api.mybetcode.com/api/v1/retrieve?" +
    new URLSearchParams({ bookie, code: code.slice(0, 50) });

  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-API-Key": key } });
  } catch {
    return Response.json({ ok: false, error: "Could not reach the booking-code service. Try again in a minute." }, { status: 502 });
  }

  const dailyLeft = res.headers.get("x-ratelimit-daily-remaining");
  const monthlyLeft = res.headers.get("x-ratelimit-monthly-remaining");
  const meta = { dailyRemaining: dailyLeft ? Number(dailyLeft) : null, monthlyRemaining: monthlyLeft ? Number(monthlyLeft) : null };

  if (res.status === 402) {
    return Response.json({ ok: false, ...meta, error: "This month's free decoding is finished — it resets on the 1st. You can still use the manual slip analyzer below." }, { status: 402 });
  }
  if (res.status === 429) {
    return Response.json({ ok: false, ...meta, error: "Daily limit reached — free plan has 10 decodes per day. Come back tomorrow, or use the manual analyzer for now." }, { status: 429 });
  }

  let data: { message?: string; data?: Sel[] | null; error?: string; reason_code?: string; context?: Record<string, unknown> } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data) {
    return Response.json({ ok: false, ...meta, error: `Booking-code service answered oddly (HTTP ${res.status}). Try again.` }, { status: 502 });
  }

  if (data.message === "success") {
    const selections = (data.data || []).map((s) => ({
      home: s.home_team || "",
      away: s.away_team || "",
      kickoff_utc: s.kickoff_utc || "",
      competition: s.competition || "",
      market: s.market || "",
      specifier: String(s.specifier || ""),
      pick: s.pick || "",
      odds: typeof s.odds === "number" ? s.odds : null,
    }));
    if (selections.length === 0) {
      return Response.json({ ok: false, ...meta, error: "The code opened, but the slip was empty." });
    }
    return Response.json({ ok: true, ...meta, selections });
  }

  const reasons: Record<string, string> = {
    invalid_code: "That code doesn't look like a real booking code — check the characters and try again.",
    code_not_found: "We can't find that code. It may be too old, from a cancelled slip, or typed with a wrong character.",
    empty_slip: "The code opened, but the slip inside is empty.",
    unsupported_bookmaker: "That bookie isn't supported by the decoder yet. Try Sportybet NG, Bet9ja or Nairabet.",
    unsupported_sport: "The slip contains a sport the decoder can't handle yet.",
    malformed_response: "The bookie's page didn't come back in a readable format. Try again in a few minutes.",
    source_unreachable: "The bookie's site is busy or blocking the decoder right now. Try again shortly.",
    conversion_failed: "We couldn't convert the slip. Try again shortly.",
    event_resolution_not_implemented: "This bookie/sport mix isn't supported yet.",
  };
  const msg = reasons[data.reason_code || ""] || data.error || `The code didn't check out (code: ${data.reason_code || "unknown"}).`;
  return Response.json({ ok: false, ...meta, error: msg, reason: data.reason_code || null });
}
