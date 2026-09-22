import type { Metadata } from "next";
import SlipLab from "@/components/SlipLab";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Slip Lab — Check Any Slip Before You Stake It",
  description:
    "Paste your accumulator — from any bookmaker — and see the honest maths: true combined odds, the bookmaker's margin, how correlation between legs drags the real chance down, and what a disciplined stake looks like. No tips, no predictions, just arithmetic.",
  alternates: { canonical: "/slip-lab/" },
  openGraph: {
    title: "Slip Lab — check any slip before you stake it",
    description:
      "True combined odds, bookmaker margin, correlation warnings and a stake size that won't wreck your bankroll. Works with any bookmaker's slip.",
  },
};

export default function SlipLabPage() {
  return <SlipLab />;
}
