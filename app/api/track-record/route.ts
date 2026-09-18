import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HIST = path.join(
  process.cwd(),
  "backend",
  "app",
  "results",
  "history.json"
);

export async function GET() {
  try {
    const hist = JSON.parse(fs.readFileSync(HIST, "utf8"));
    return NextResponse.json({ ok: true, ...hist });
  } catch {
    return NextResponse.json({
      ok: true,
      days: {},
      cumulative: null,
      empty: true,
    });
  }
}
