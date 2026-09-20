"use client";

import { useState } from "react";
import PredictionCard from "@/components/PredictionCardV2";
import type { CardModel } from "@/lib/card";
import { isFinished, kickoffMs, useNow } from "@/lib/live";

/**
 * The board surface. It splits events into live and finished on every render,
 * so a match leaves the board the moment it is over — no rebuild, no cron.
 *
 * Finished events are never shown as upcoming picks. If the board has nothing
 * left live (which is what a stale data feed looks like), we say so plainly
 * and show the completed events underneath, labelled — an empty page with a
 * cheerful "nothing here" is worse than the truth.
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
  // now === 0 until the component mounts, so the server and the first client
  // render agree; expiry kicks in on the first tick.
  const now = useNow(60_000);
  const [showFinished, setShowFinished] = useState(false);

  const live: CardModel[] = [];
  const done: CardModel[] = [];
  for (const c of cards) {
    const expired = now > 0 && isFinished(kickoffMs(dataDate, c.kickoff), now, graceMinutes);
    if (c.status === "SETTLED" || expired) {
      done.push(c);
    } else {
      live.push(c);
    }
  }

  // Nothing live but plenty finished: the board is between drops. Show the
  // completed events rather than an empty page.
  const showDone = showFinished || (live.length === 0 && done.length > 0);

  return (
    <div>
      {live.length > 0 ? (
        <div className="pick-grid">
          {live.map((c) => (
            <PredictionCard key={c.id} card={c} />
          ))}
        </div>
      ) : (
        <div className="ds-state">
          <div className="ds-state-title">Nothing upcoming on the board</div>
          <div>
            {done.length > 0
              ? "Every event currently loaded has kicked off. The completed ones are listed below — the next board publishes after the morning data drop."
              : emptyMessage}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="finished-strip" style={{ marginTop: "var(--s-4)" }}>
          <span>
            {done.length} completed event{done.length === 1 ? "" : "s"}
            {live.length > 0 ? " — removed from the board" : " — awaiting the next data drop"}
          </span>
          <button onClick={() => setShowFinished((s) => !s)}>
            {showDone ? "Hide completed" : "Show completed"}
          </button>
        </div>
      )}

      {showDone && done.length > 0 && (
        <div className="pick-grid" style={{ marginTop: "var(--s-3)", opacity: 0.6 }}>
          {done.map((c) => (
            <PredictionCard key={c.id} card={{ ...c, status: "SETTLED" }} />
          ))}
        </div>
      )}
    </div>
  );
}
