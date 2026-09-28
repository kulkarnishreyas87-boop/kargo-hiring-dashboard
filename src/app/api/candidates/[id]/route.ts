import { NextResponse } from "next/server";
import { all, one } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const candidate = await one<Record<string, unknown>>(`SELECT * FROM candidates WHERE id = $1`, [id]);
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const score = await one<Record<string, unknown>>(`SELECT * FROM scores WHERE candidate_id = $1`, [id]);
  const brief = await one<Record<string, unknown>>(`SELECT * FROM briefs WHERE candidate_id = $1`, [id]);
  const emails = await all(`SELECT * FROM emails WHERE candidate_id = $1 ORDER BY created_at ASC`, [id]);
  const decision = await one<Record<string, unknown>>(`SELECT * FROM decisions WHERE candidate_id = $1`, [id]);
  const audit = await all(`SELECT * FROM audit_log WHERE candidate_id = $1 ORDER BY created_at ASC`, [id]);

  return NextResponse.json({
    candidate,
    score: score
      ? { ...score, raw: JSON.parse(score.raw_json as string), guardrail: JSON.parse(score.guardrail_json as string), probes: JSON.parse(score.probes_json as string) }
      : null,
    brief: brief ?? null,
    emails,
    decision: decision ?? { candidate_id: id, decision: "pending", note: null },
    audit,
  });
}
