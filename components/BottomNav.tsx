"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 4.0 mobile bottom bar: the five core destinations (per master spec).
// Sport sections stay one tap away from Home and Picks.
const ITEMS = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/predictions/", icon: "🎯", label: "Picks" },
  { href: "/live/", icon: "", label: "Live" },
  { href: "/slip/", icon: "🧪", label: "Slip" },
  { href: "/board/", icon: "🔮", label: "Oracle" },
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
