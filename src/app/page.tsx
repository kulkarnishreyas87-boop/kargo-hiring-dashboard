"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { HeroIllustration } from "@/components/HeroIllustration";
import { DonutChart, BarChart } from "@/components/Charts";

interface CandidateRow {
  id: string;
  recommended_role: string | null;
  final_tier: string | null;
  pipeline_status: string;
}

interface Stats {
  total: number;
  byTier: { final_tier: string; n: string }[];
  potentialFlagged: number;
  decisions: { decision: string; n: string }[];
  emailsSent: number;
  emailsDrafted: number;
}

function tierCount(stats: Stats | null, tier: string): number {
  return Number(stats?.byTier.find((t) => t.final_tier === tier)?.n ?? 0);
}

function decisionCount(stats: Stats | null, decision: string): number {
  return Number(stats?.decisions.find((d) => d.decision === decision)?.n ?? 0);
}

/** Counts up to `value` once, on mount / whenever value first becomes truthy. Purely cosmetic. */
function useCountUp(value: number, durationMs = 600) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    started.current = true;
    const start = performance.now();
    const from = 0;
    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

function StatCard({
  label,
  value,
  accent,
  dot,
  delay,
}: {
  label: string;
  value: number;
  accent: string;
  dot: string;
  delay: number;
}) {
  const display = useCountUp(value);
  return (
    <div
      className="animate-fade-in-up group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-x-0 top-0 h-0.5 ${dot} opacity-0 transition-opacity group-hover:opacity-100`} />
      <div className="flex items-center gap-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
        <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      </div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${accent}`}>{display}</div>
    </div>
  );
}

function ChartCard({ title, delay, children }: { title: string; delay: number; children: ReactNode }) {
  return (
    <div
      className="animate-fade-in-up rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 className="text-sm font-medium text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [candidatesRes, statsRes] = await Promise.all([
      fetch("/api/candidates", { cache: "no-store" }),
      fetch("/api/stats", { cache: "no-store" }),
    ]);
    const data = await candidatesRes.json();
    setRows(data.candidates ?? []);
    setStats(await statsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const unscored = rows.filter((r) => r.pipeline_status === "pending" || r.pipeline_status === "error").length;
  const pmCount = rows.filter((r) => r.recommended_role === "PM").length;
  const spmCount = rows.filter((r) => r.recommended_role === "SPM").length;

  function handleHeroMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    e.currentTarget.style.setProperty("--y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <div className="space-y-6">
      <div
        onMouseMove={handleHeroMouseMove}
        className="hero-glow animate-fade-in-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/40 px-6 py-8 sm:px-10 sm:py-10"
      >
        <div className="grid md:grid-cols-2 gap-6 items-center relative">
          <div>
            <p className="text-xs font-medium tracking-wide uppercase text-indigo-600 mb-2">Kargo · Hiring</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              A shortlist <span className="gradient-text">Arjun can trust</span>
            </h1>
            <p className="text-slate-500 text-sm sm:text-base mt-3 max-w-md">
              Ranked by best composite across both roles, scored against the hire pattern, not the job spec. The
              system recommends, you decide, and that decision is the last thing you touch.
            </p>
            <div className="flex gap-2 text-sm mt-5 flex-wrap">
              <Link
                href="/candidates"
                className="rounded-md bg-slate-900 text-white px-4 py-2.5 font-medium transition-all hover:bg-slate-700 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                View candidates
              </Link>
              <Link
                href="/upload"
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-slate-400 active:translate-y-0"
              >
                Upload CVs
              </Link>
              <Link
                href="/pipeline"
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-slate-400 active:translate-y-0"
              >
                View pipeline
              </Link>
            </div>
          </div>
          <HeroIllustration className="w-full max-w-md justify-self-center md:justify-self-end drop-shadow-sm" />
        </div>
      </div>

      {!loading && stats && stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total scored" value={stats.total} accent="text-slate-900" dot="bg-indigo-500" delay={0} />
          <StatCard label="Interview" value={tierCount(stats, "INTERVIEW")} accent="text-emerald-700" dot="bg-emerald-500" delay={60} />
          <StatCard label="Review" value={tierCount(stats, "REVIEW")} accent="text-amber-700" dot="bg-amber-500" delay={120} />
          <StatCard label="Pass" value={tierCount(stats, "PASS")} accent="text-rose-700" dot="bg-rose-400" delay={180} />
          <StatCard label="High potential" value={stats.potentialFlagged} accent="text-violet-700" dot="bg-violet-500" delay={240} />
        </div>
      )}

      {unscored > 0 && (
        <div className="animate-fade-in-up rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          {unscored} candidate{unscored === 1 ? "" : "s"} not yet scored. Upload evaluates automatically now — or run{" "}
          <code className="bg-amber-100 px-1 rounded">npm run pipeline</code> from the project root to catch up any stragglers.
        </div>
      )}

      {!loading && stats && stats.total > 0 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Tier distribution" delay={0}>
            <DonutChart
              data={[
                { label: "Interview", value: tierCount(stats, "INTERVIEW"), color: "#10b981" },
                { label: "Review", value: tierCount(stats, "REVIEW"), color: "#f59e0b" },
                { label: "Pass", value: tierCount(stats, "PASS"), color: "#fb7185" },
              ]}
            />
          </ChartCard>
          <ChartCard title="Shortlist decisions" delay={80}>
            <BarChart
              data={[
                { label: "Pending", value: decisionCount(stats, "pending"), color: "#94a3b8" },
                { label: "Advanced", value: decisionCount(stats, "advance"), color: "#3b82f6" },
                { label: "Declined", value: decisionCount(stats, "reject"), color: "#fb7185" },
              ]}
            />
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Emails sent</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                {stats.emailsSent} / {stats.emailsSent + stats.emailsDrafted}
              </span>
            </div>
          </ChartCard>
          <ChartCard title="Recommended role split" delay={160}>
            <BarChart
              data={[
                { label: "Product Manager", value: pmCount, color: "#6366f1" },
                { label: "Senior PM", value: spmCount, color: "#a855f7" },
              ]}
            />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
