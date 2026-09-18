import { NextResponse } from "next/server";
import SNAPSHOT from "@/lib/data-snapshot.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hist = (SNAPSHOT.history as any) || { days: {}, cumulative: null };
  return NextResponse.json({
    ok: true,
    empty: !hist.cumulative,
    ...hist,
  });
}
