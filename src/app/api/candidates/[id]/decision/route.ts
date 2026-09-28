import { NextResponse } from "next/server";
import { one, exec, logAudit } from "@/lib/db";

const VALID = new Set(["pending", "advance", "reject"]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body.decision;
  const note = typeof body.note === "string" ? body.note : null;

  if (!VALID.has(decision)) {
    return NextResponse.json({ error: "decision must be pending|advance|reject" }, { status: 400 });
  }

  const candidate = await one(`SELECT id FROM candidates WHERE id = $1`, [id]);
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await exec(
    `INSERT INTO decisions (candidate_id, decision, note, decided_at) VALUES ($1, $2, $3, now())
     ON CONFLICT(candidate_id) DO UPDATE SET decision = excluded.decision, note = excluded.note, decided_at = now()`,
    [id, decision, note]
  );

  await logAudit(id, "human_decision", { decision, note });

  return NextResponse.json({ ok: true });
}
