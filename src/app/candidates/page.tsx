"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { scoreBoxClass } from "@/lib/scoreTone";

interface CandidateRow {
  id: string;
  name: string;
  applied_role: string;
  pipeline_status: string;
  pipeline_error: string | null;
  pattern_score: number | null;
  composite_pm: number | null;
  tier_pm: string | null;
  composite_spm: number | null;
  tier_spm: string | null;
  recommended_role: string | null;
  reroute_suggested: number | null;
  final_tier: string | null;
  potential_flag: number | null;
  potential_reason: string | null;
  best_composite: number | null;
  why_ranked_here: string | null;
  decision: string | null;
  decision_note: string | null;
  emails_sent: number;
}

const TIER_STYLES: Record<string, string> = {
  INTERVIEW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  PASS: "bg-slate-100 text-slate-600 border-slate-200",
};

const DECISION_STYLES: Record<string, string> = {
  advance: "bg-blue-100 text-blue-800 border-blue-200",
  reject: "bg-rose-100 text-rose-700 border-rose-200",
  pending: "bg-slate-50 text-slate-500 border-slate-200",
};

function ScoreBox({ value }: { value: number | null }) {
  return (
    <span className={`inline-block min-w-[3.25rem] text-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums transition-transform hover:scale-105 ${scoreBoxClass(value)}`}>
      {value != null ? value.toFixed(1) : "—"}
    </span>
  );
}

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <tr className="border-t border-slate-100 animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton-shimmer h-3.5 rounded" style={{ width: `${40 + ((i * 13) % 50)}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function CandidatesPage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [potentialOnly, setPotentialOnly] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/candidates", { cache: "no-store" });
    const data = await res.json();
    setRows(data.candidates ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tierFilter !== "all" && r.final_tier !== tierFilter) return false;
      if (roleFilter !== "all" && r.recommended_role !== roleFilter) return false;
      if (potentialOnly && !r.potential_flag) return false;
      if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [rows, tierFilter, roleFilter, potentialOnly, query]);

  const unscored = rows.filter((r) => r.pipeline_status === "pending" || r.pipeline_status === "error").length;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up flex items-start gap-4">
        <div className="float-slow shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="3.5" stroke="white" strokeWidth="2" />
            <path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-slate-500 text-sm mt-1">
            Every scored candidate, ranked by best composite across both roles. The system recommends — you decide.
          </p>
        </div>
      </div>

      {unscored > 0 && (
        <div className="animate-fade-in-up rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          {unscored} candidate{unscored === 1 ? "" : "s"} not yet scored. Upload evaluates automatically now — or run{" "}
          <code className="bg-amber-100 px-1 rounded">npm run pipeline</code> from the project root to catch up any stragglers.
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center text-sm animate-fade-in-up" style={{ animationDelay: "80ms" }}>
        <input
          placeholder="Search name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 w-48 text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">All tiers</option>
          <option value="INTERVIEW">Interview</option>
          <option value="REVIEW">Review</option>
          <option value="PASS">Pass</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-slate-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="all">Both roles</option>
          <option value="PM">Recommended: PM</option>
          <option value="SPM">Recommended: SPM</option>
        </select>
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={potentialOnly} onChange={(e) => setPotentialOnly(e.target.checked)} />
          High-potential flag only
        </label>
        <span className="text-slate-400 ml-auto tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white animate-fade-in-up" style={{ animationDelay: "120ms" }}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Candidate</th>
              <th className="px-4 py-2 font-medium">Applied</th>
              <th className="px-4 py-2 font-medium">Recommended</th>
              <th className="px-4 py-2 font-medium">Tier</th>
              <th className="px-4 py-2 font-medium">Composite</th>
              <th className="px-4 py-2 font-medium">Pattern</th>
              <th className="px-4 py-2 font-medium">Flags</th>
              <th className="px-4 py-2 font-medium">Decision</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} delay={i * 40} />)}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  No candidates match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50 animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
                >
                  <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-2">
                    <Link href={`/candidates/${r.id}`} className="font-medium text-slate-900 hover:underline">
                      {r.name}
                    </Link>
                    {r.pipeline_status !== "drafted" && r.pipeline_status !== "scored" && (
                      <span className="ml-2 text-xs text-slate-400">({r.pipeline_status})</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.applied_role}</td>
                  <td className="px-4 py-2">
                    {r.recommended_role ?? "—"}
                    {r.reroute_suggested ? <span className="ml-1 text-xs text-indigo-600">reroute?</span> : null}
                  </td>
                  <td className="px-4 py-2">
                    {r.final_tier ? (
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium transition-transform hover:scale-105 ${TIER_STYLES[r.final_tier]}`}
                      >
                        {r.final_tier}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <ScoreBox value={r.best_composite} />
                  </td>
                  <td className="px-4 py-2">
                    <ScoreBox value={r.pattern_score} />
                  </td>
                  <td className="px-4 py-2">
                    {r.potential_flag ? (
                      <span
                        title={r.potential_reason ?? ""}
                        className="animate-pop-in inline-block rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 text-xs font-medium"
                      >
                        potential
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${DECISION_STYLES[r.decision ?? "pending"]}`}>
                      {r.decision ?? "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/candidates/${r.id}`} className="text-slate-500 transition-colors hover:text-slate-900 text-xs">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
