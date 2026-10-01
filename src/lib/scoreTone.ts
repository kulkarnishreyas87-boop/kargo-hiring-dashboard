/** Traffic-light coloring for 0-100 scores (composite, pattern), same thresholds as the rubric's tiers. */
export function scoreBoxClass(score: number | null | undefined): string {
  if (score == null) return "bg-slate-50 text-slate-400 border-slate-200";
  if (score >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 55) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-600 border-rose-200";
}
