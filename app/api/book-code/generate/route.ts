// POST /api/book-code/generate — MyBetCode booking-code GENERATION (server-side).
// The user builds a slip (or picks games); we send the selections to the
// booking-code engine and it returns a real booking code for the chosen bookie.
// The API key never reaches the browser.
//
// Body: { bookie: "sportybet:ng", selections: [{home, away, kickoff_utc, market, specifier, pick, odds?}] }
// Returns: { ok, code?, error?, dailyRemaining?, monthlyRemaining?, raw? }
export const maxDuration = 30;

type Sel = {
  home?: string;
  away?: string;
  kickoff_utc?: string;
  competition?: string;
  market?: string;
  specifier?: string;
  pick?: string;
  odds?: number | null;
  [k: string]: unknown;
};

export async function POST(req: Request) {
  let body: { bookie?: string; selections?: Sel[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Send a JSON body { bookie, selections }." }, { status: 400 });
  }
  const bookie = String(body.bookie || "").trim();
  const selections = Array.isArray(body.selections) ? body.selections : [];
  if (!bookie || selections.length === 0) {
    return Response.json({ ok: false, error: "Pick a bookie and add at least one game to the slip." }, { status: 400 });
  }

  const key = process.env.MYBETCODE_KEY;
  if (!key) {
    return Response.json(
      { ok: false, error: "Booking-code engine not configured on the server yet. Ask the admin to set MYBETCODE_KEY on Vercel." },
      { status: 503 }
    );
  }

  // Mirror the retrieve() selection shape (the natural inverse of a decode).
  const payload = {
    bookie,
    selections: selections.map((s) => ({
      home_team: s.home || "",
      away_team: s.away || "",
      kickoff_utc: s.kickoff_utc || "",
      competition: s.competition || "",
      market: s.market || "",
      specifier: String(s.specifier || ""),
      pick: s.pick || "",
      ...(typeof s.odds === "number" ? { odds: s.odds } : {}),
    })),
  };

  const url = "https://api.mybetcode.com/api/v1/generate?" + new URLSearchParams({ bookie });
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return Response.json({ ok: false, error: "Could not reach the booking-code service. Try again in a minute." }, { status: 502 });
  }

  const dailyLeft = res.headers.get("x-ratelimit-daily-remaining");
  const monthlyLeft = res.headers.get("x-ratelimit-monthly-remaining");
  const meta = { dailyRemaining: dailyLeft ? Number(dailyLeft) : null, monthlyRemaining: monthlyLeft ? Number(monthlyLeft) : null };

  if (res.status === 402) {
    return Response.json({ ok: false, ...meta, error: "This month's free code generation is finished — it resets on the 1st." }, { status: 402 });
  }
  if (res.status === 429) {
    return Response.json({ ok: false, ...meta, error: "Daily code-generation limit reached — it resets tomorrow. You can still decode existing codes." }, { status: 429 });
  }

  let data: { message?: string; data?: any; error?: string; [k: string]: unknown } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data) {
    return Response.json({ ok: false, ...meta, error: `Booking-code service answered oddly (HTTP ${res.status}). Try again.`, raw: null }, { status: 502 });
  }

  // The generate endpoint may return the code as data.code, data.booking_code,
  // data.destination_code, or data itself being a string. Be permissive.
  const d = data.data;
  const code =
    (typeof d === "string" && d) ||
    (d && typeof d === "object" && (d.code || d.booking_code || d.destination_code || d.generated_code)) ||
    (typeof data === "object" && (data as any).code) ||
    null;

  if (data.message === "success" && code) {
    return Response.json({ ok: true, ...meta, code: String(code), bookie });
  }

  // Surface the API's own message so we can refine the request shape if needed.
  const apiMsg = data.error || (typeof d === "object" && d ? d.message : "") || (data.message === "error" ? `HTTP ${res.status}` : data.message) || `Unexpected response (HTTP ${res.status})`;
  return Response.json(
    { ok: false, ...meta, error: `Code service: ${apiMsg}`, raw: JSON.stringify(d ?? data).slice(0, 500) },
    { status: res.status >= 400 ? res.status : 502 }
  );
}
