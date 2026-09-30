"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/upload", label: "Upload CVs" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative px-3 py-1.5 rounded-md transition-colors ${
              active ? "text-slate-900 font-medium" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {link.label}
            {active && (
              <span className="absolute left-3 right-3 -bottom-[13px] h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-amber-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
