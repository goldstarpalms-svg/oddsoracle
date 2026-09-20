"use client";

import { useEffect, useState } from "react";
import { parseKickoff } from "@/lib/matchClock";

/**
 * Live kickoff state, computed in the visitor's browser (Lagos time WAT is
 * the site's reference; visitors elsewhere still see a sensible countdown
 * because the clock advances live). Refreshes every 30s.
 * Accepts "HH:MM" or "D/M HH:MM" (next-day games).
 */
export default function TimeChip({ t, dataDate }: { t: string; dataDate?: string | null }) {
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!t) return <span className="time-chip">⏰ time TBD</span>;
  const raw = String(t).trim();
  const label = raw.replace(/^(\d{1,2})\/(\d{1,2})\s+/, ""); // "06:00" for "21/9 06:00"
  if (!now) return <span className="time-chip">⏰ {label} WAT</span>;

  const start = parseKickoff(raw, null, dataDate);
  if (start == null) return <span className="time-chip">⏰ {label} WAT</span>;
  const diffMin = Math.round((start - now) / 60000);

  let cls = "time-chip";
  let txt: string;
  if (diffMin > 180) txt = `⏰ ${label} WAT`;
  else if (diffMin > 30) {
    cls += " soon";
    txt = `🟡 In ${diffMin} min`;
  } else if (diffMin > 5) {
    cls += " soon";
    txt = `🟡 In ${diffMin} min`;
  } else if (diffMin > -15) {
    cls += " live";
    txt = "🔴 Kicking off";
  } else if (diffMin > -200) {
    cls += " live";
    txt = "🔴 Started";
  } else {
    cls += " done";
    txt = `⏰ ${label} WAT`;
  }
  return <span className={cls}>{txt}</span>;
}
