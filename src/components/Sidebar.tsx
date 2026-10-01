"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="12" width="8" height="9" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/candidates",
    label: "Candidates",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/pipeline",
    label: "Pipeline",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="4" width="6" height="16" rx="1.5" />
        <rect x="14" y="4" width="6" height="10" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/upload",
    label: "Upload CVs",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16V6M12 6l-4 4M12 6l4 4M5 18h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-slate-900 group px-5 py-5">
        <span className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-sm font-bold transition-transform group-hover:scale-105 shrink-0">
          K
        </span>
        <span>
          Kargo <span className="text-slate-400 font-normal block text-xs -mt-0.5">Hiring</span>
        </span>
      </Link>
      <nav className="flex-1 px-3 space-y-1">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-0.5"
              }`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-amber-400" />}
              <span className={`shrink-0 transition-colors ${active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`} style={{ stroke: "currentColor" }}>
                <span className="[&>svg]:stroke-current [&>svg]:stroke-2">{link.icon}</span>
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-400 border-t border-slate-100">
        The system recommends. You decide.
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:border-slate-200 md:bg-white md:sticky md:top-0 md:h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile top bar — fixed (not sticky) so it escapes the parent flex row entirely;
          as a sticky/static element it was being laid out as a flex-row sibling of <main>
          instead of stacking above it. */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-sm px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
          <span className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-xs font-bold">
            K
          </span>
          Kargo <span className="text-slate-400 font-normal">/ Hiring</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl animate-pop-in" style={{ animationDuration: "0.25s" }}>
            <div className="flex justify-end px-3 pt-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
