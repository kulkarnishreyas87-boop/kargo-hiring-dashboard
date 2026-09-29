import { NextResponse } from "next/server";
import { one, exec, logAudit } from "@/lib/db";
import { ensureEmailDraft } from "@/lib/pipeline";
import { sendDraftedEmail } from "@/lib/sendEmail";

export const maxDuration = 30;

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

  // Advancing or rejecting a candidate sends the matching drafted email right away — no
  // separate confirm step. This was an explicit, informed choice: the app's default is to
  // require a manual click on the email itself before anything sends, but this project's
  // owner asked for one-click decisions after being told that removes that safety net.
  let emailResult: { attempted: boolean; ok?: boolean; error?: string; kind?: "invite" | "rejection" } = { attempted: false };
  if (decision === "advance" || decision === "reject") {
    const kind = decision === "advance" ? "invite" : "rejection";
    try {
      const email = await ensureEmailDraft(id, kind);
      const sendOutcome = await sendDraftedEmail(email.id);
      emailResult = { attempted: true, ok: sendOutcome.ok, error: sendOutcome.error, kind };
    } catch (e) {
      emailResult = { attempted: true, ok: false, error: (e as Error).message, kind };
    }
  }

  return NextResponse.json({ ok: true, email: emailResult });
}
