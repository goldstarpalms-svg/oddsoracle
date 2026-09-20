"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/live/", icon: "", label: "Live" },
  { href: "/predictions/football/", icon: "⚽", label: "Football" },
  { href: "/predictions/basketball/", icon: "🏀", label: "Hoops" },
  { href: "/predictions/tennis/", icon: "🎾", label: "Tennis" },
  { href: "/track-record/", icon: "📈", label: "Record" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className={active(i.href) ? "active" : ""}>
          <span className="bni">{i.icon}</span>
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
