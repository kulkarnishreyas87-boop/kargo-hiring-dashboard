"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface CandidateRow {
  id: string;
  name: string;
  applied_role: string;
  pipeline_status: string;
  recommended_role: string | null;
  final_tier: string | null;
  best_composite: number | null;
  potential_flag: number | null;
  decision: string | null;
  emails_sent: number;
}

const TIER_STYLES: Record<string, string> = {
  INTERVIEW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
  PASS: "bg-slate-100 text-slate-600 border-slate-200",
};

const COLUMNS: { key: string; label: string; hint: string; accent: string }[] = [
  { key: "pending", label: "Needs review", hint: "Scored, waiting on a shortlist call", accent: "border-t-slate-400" },
  { key: "advance", label: "Advancing", hint: "Interview invite sent (or sending)", accent: "border-t-blue-500" },
  { key: "reject", label: "Declined", hint: "Rejection sent (or sending)", accent: "border-t-rose-500" },
];

export default function PipelinePage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const byColumn = useMemo(() => {
    const groups: Record<string, CandidateRow[]> = { pending: [], advance: [], reject: [] };
    for (const r of rows) {
      const d = r.decision ?? "pending";
      (groups[d] ?? groups.pending).push(r);
    }
    return groups;
  }, [rows]);

  async function move(candidateId: string, decision: string) {
    setBusyId(candidateId);
    await fetch(`/api/candidates/${candidateId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    await load();
    setBusyId(null);
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-semibold tracking-tight">Hiring pipeline</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every scored candidate, grouped by where they stand. Moving a card into Advancing or Declined sends that
          candidate&apos;s email immediately, same as the buttons on their page.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col, colIdx) => (
          <div
            key={col.key}
            className={`animate-fade-in-up rounded-lg border border-slate-200 border-t-4 ${col.accent} bg-white flex flex-col`}
            style={{ animationDelay: `${colIdx * 60}ms` }}
          >
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-slate-900">{col.label}</h2>
                <span className="text-xs text-slate-400 tabular-nums bg-slate-50 rounded-full px-2 py-0.5">
                  {loading ? "…" : byColumn[col.key]?.length ?? 0}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{col.hint}</p>
            </div>
            <div className="p-3 space-y-2.5 flex-1 min-h-[120px]">
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton-shimmer h-20 rounded-md" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              {!loading && (byColumn[col.key]?.length ?? 0) === 0 && (
                <p className="text-xs text-slate-300 text-center py-6">Nothing here</p>
              )}
              {!loading &&
                byColumn[col.key]?.map((r, i) => (
                  <div
                    key={r.id}
                    className="animate-fade-in-up rounded-md border border-slate-200 p-3 text-sm hover:shadow-sm transition-shadow"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/candidates/${r.id}`} className="font-medium text-slate-900 hover:underline leading-tight">
                        {r.name}
                      </Link>
                      {r.final_tier && (
                        <span className={`shrink-0 inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIER_STYLES[r.final_tier]}`}>
                          {r.final_tier}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{r.recommended_role ?? "—"}</span>
                      <span className="tabular-nums">{r.best_composite != null ? r.best_composite.toFixed(1) : "—"}</span>
                      {r.potential_flag ? <span className="text-violet-600">potential</span> : null}
                      {r.emails_sent > 0 && <span className="text-emerald-600">✓ emailed</span>}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {col.key !== "advance" && (
                        <button
                          onClick={() => move(r.id, "advance")}
                          disabled={busyId === r.id}
                          className="text-[11px] rounded border border-blue-200 text-blue-700 bg-blue-50 px-2 py-1 hover:bg-blue-100 disabled:opacity-40 transition-colors"
                        >
                          Advance
                        </button>
                      )}
                      {col.key !== "reject" && (
                        <button
                          onClick={() => move(r.id, "reject")}
                          disabled={busyId === r.id}
                          className="text-[11px] rounded border border-rose-200 text-rose-700 bg-rose-50 px-2 py-1 hover:bg-rose-100 disabled:opacity-40 transition-colors"
                        >
                          Reject
                        </button>
                      )}
                      {col.key !== "pending" && (
                        <button
                          onClick={() => move(r.id, "pending")}
                          disabled={busyId === r.id}
                          className="text-[11px] rounded border border-slate-200 text-slate-600 bg-slate-50 px-2 py-1 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
