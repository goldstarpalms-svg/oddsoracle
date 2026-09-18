"use client";

import { useEffect, useState } from "react";

/**
 * Live kickoff state, computed in the visitor's browser (Lagos time WAT is the
 * site's reference; visitors elsewhere still see a sensible countdown because
 * the clock advances live). Refreshes every 30s.
 */
export default function TimeChip({ t }: { t: string }) {
  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!now || !t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const kickoff = new Date();
  kickoff.setHours(Number(m[1]), Number(m[2]), 0, 0);
  const diffMin = Math.round((kickoff.getTime() - now) / 60000);

  let cls = "time-chip";
  let txt: string;
  if (diffMin > 90) txt = `⏰ ${t} WAT`;
  else if (diffMin > 30) {
    cls += " soon";
    txt = `🟡 In ${diffMin} min`;
  } else if (diffMin > 5) {
    cls += " soon";
    txt = `🟡 In ${diffMin} min`;
  } else if (diffMin > -15) {
    cls += " live";
    txt = "🔴 Kicking off";
  } else if (diffMin > -180) {
    cls += " live";
    txt = "🔴 Started";
  } else {
    cls += " done";
    txt = `⏰ ${t} WAT`;
  }
  return <span className={cls}>{txt}</span>;
}
