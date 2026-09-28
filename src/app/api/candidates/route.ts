import { NextResponse } from "next/server";
import { all } from "@/lib/db";

export async function GET() {
  const rows = await all(
    `SELECT
        c.id, c.name, c.source, c.applied_role, c.pipeline_status, c.pipeline_error,
        s.pattern_score, s.role_score_pm, s.composite_pm, s.tier_pm,
        s.role_score_spm, s.composite_spm, s.tier_spm,
        s.recommended_role, s.reroute_suggested, s.final_tier, s.potential_flag, s.potential_reason,
        s.best_composite, s.why_ranked_here,
        d.decision, d.note as decision_note,
        (SELECT COUNT(*) FROM emails e WHERE e.candidate_id = c.id AND e.status = 'sent') as emails_sent
      FROM candidates c
      LEFT JOIN scores s ON s.candidate_id = c.id
      LEFT JOIN decisions d ON d.candidate_id = c.id
      WHERE c.source = 'applicant'
      ORDER BY (s.best_composite IS NULL) ASC, s.best_composite DESC, c.name ASC`
  );

  return NextResponse.json({ candidates: rows });
}
