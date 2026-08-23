"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "期間" },
  { href: "/staff", label: "スタッフ" },
  { href: "/template", label: "曜日テンプレート" },
  { href: "/rules", label: "労働ルール" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          data-active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
