import { NextResponse } from "next/server";
import { getPredictions, refreshPredictions } from "@/lib/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getPredictions();
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

// POST ?refresh=1 forces a recompute (used by cron / manual trigger).
export async function POST() {
  try {
    const result = await refreshPredictions();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
