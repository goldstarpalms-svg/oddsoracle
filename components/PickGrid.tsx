"use client";

import { useState } from "react";
import PredictionCard from "@/components/PredictionCardV2";
import type { CardModel } from "@/lib/card";
import { isFinished, kickoffMs, useNow } from "@/lib/live";

/**
 * The board surface. It splits events into live and finished on every render,
 * so a match disappears from the board the moment it is over — without waiting
 * for a rebuild. Finished events collapse into a single strip; they are never
 * presented as upcoming picks.
 */
export default function PickGrid({
  cards,
  dataDate,
  graceMinutes,
  emptyMessage = "No upcoming events on the board right now.",
}: {
  cards: CardModel[];
  dataDate: string | null | undefined;
  graceMinutes?: number;
  emptyMessage?: string;
}) {
  const now = useNow(60_000);
  const [showFinished, setShowFinished] = useState(false);

  const live: CardModel[] = [];
  const done: CardModel[] = [];
  for (const c of cards) {
    if (c.status === "SETTLED" || isFinished(kickoffMs(dataDate, c.kickoff), now, graceMinutes)) {
      done.push(c);
    } else {
      live.push(c);
    }
  }

  return (
    <div>
      {live.length === 0 ? (
        <div className="ds-state">
          <div className="ds-state-title">Nothing upcoming</div>
          <div>{emptyMessage}</div>
        </div>
      ) : (
        <div className="pick-grid">
          {live.map((c) => (
            <PredictionCard key={c.id} card={c} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="finished-strip" style={{ marginTop: "var(--s-4)" }}>
          <span>
            {done.length} event{done.length === 1 ? "" : "s"} finished and removed from the board
            {showFinished ? " — showing for reference" : ""}
          </span>
          <button onClick={() => setShowFinished((s) => !s)}>
            {showFinished ? "Hide finished" : "Show finished"}
          </button>
        </div>
      )}

      {showFinished && done.length > 0 && (
        <div className="pick-grid" style={{ marginTop: "var(--s-3)", opacity: 0.62 }}>
          {done.map((c) => (
            <PredictionCard key={c.id} card={{ ...c, status: "SETTLED" }} />
          ))}
        </div>
      )}
    </div>
  );
}
