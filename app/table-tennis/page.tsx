import type { Metadata } from "next";
import Link from "next/link";
import SNAPSHOT from "@/lib/data-snapshot.json";
import TTBoard from "@/components/TTBoard";
import type { TTGame } from "@/components/TTBoard";

export const metadata: Metadata = {
  title: "Table Tennis — Setka Cup Intelligence",
  description:
    "Setka Cup first-class: first-set O/U 18.5/19.5 and sets O/U 3.5 models over 155,000 recorded matches, head-to-head, real-data player dossiers and live scores.",
};

export default function TableTennisPage() {
  const sk: any = (SNAPSHOT as any).setka || { games: [], history: { matches: 0, players: 0 }, global: null };
  const games: TTGame[] = sk.games || [];
  const g: any = sk.global || null;
  const inPlay = games.filter((x) => x.status === "Live");
  const upNext = games.filter((x) => x.status === "Scheduled");
  const strong = upNext.filter((x) => x.model.first_set.confidence === "STRONG").length;

  return (
    <div className="page pad">
      <div className="container">
        <div className="terminal" style={{ marginTop: 18 }}>
          <div className="terminal-head">
            <span className="terminal-title">
              <span className="terminal-dot" /> TABLE TENNIS — SETKA CUP · FIRST-SET &amp; SETS INTELLIGENCE
            </span>
            <Link href="/board/" className="terminal-link">
              Oracle Board →
            </Link>
          </div>
          <div className="terminal-stats">
            <div>
              <b>{sk.history?.matches?.toLocaleString() ?? "—"}</b>
              <span>matches of history</span>
            </div>
            <div>
              <b>{sk.history?.players ?? "—"}</b>
              <span>players profiled</span>
            </div>
            {g && (
              <>
                <div>
                  <b>{Math.round(g.first_set_over_18_5_rate * 100)}%</b>
                  <span>global first-set O18.5</span>
                </div>
                <div>
                  <b>{Math.round(g.sets_over_3_5_rate * 100)}%</b>
                  <span>global sets O3.5</span>
                </div>
              </>
            )}
            <div>
              <b className="sig-value-txt">{inPlay.length}</b>
              <span>live now</span>
            </div>
            <div>
              <b>{upNext.length}</b>
              <span>up next</span>
            </div>
            <div>
              <b>{strong}</b>
              <span>strong O/U spots</span>
            </div>
          </div>

          <TTBoard games={games} />

          <div className="terminal-foot">
            Model: first-set points expectation (player career + last 20 + H2H + global base) →
            normal-distribution over/under, blended 55/45 with empirical over rates; sets O/U 3.5
            blends each player&rsquo;s real 4+-set rate with the global. A faithful port of the Setka
            Cup first-set engine. History: the full recorded database
            ({sk.history?.matches?.toLocaleString()} matches). O/U reads are model probabilities, not
            odds — compare with the book before staking. Player dossiers are real match records only;
            anything unknown is shown as unavailable, never invented. Probabilities are estimates, not
            guarantees.
          </div>
        </div>
      </div>
    </div>
  );
}
