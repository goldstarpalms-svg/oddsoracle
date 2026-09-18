import type { Metadata } from "next";
import SearchBox from "@/components/SearchBox";

export const metadata: Metadata = {
  title: "Search — Teams, Players, Leagues",
  description:
    "Search today's OddsOracle predictions by team, player or league. Instant results across football, basketball and tennis.",
  alternates: { canonical: "/search/" },
};

export default function SearchPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Find any game</span>
          <h1>
            Search today&rsquo;s <span className="grad-text">picks</span>
          </h1>
          <p className="section-sub">
            Type a team, player or league — results come back instantly from today&rsquo;s full
            board.
          </p>
        </div>
      </section>

      <section className="sec">
        <div className="container">
          <SearchBox />
        </div>
      </section>
    </>
  );
}
