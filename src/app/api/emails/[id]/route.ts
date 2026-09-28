import { NextResponse } from "next/server";
import { one, exec, logAudit } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const email = await one<{ status: string; candidate_id: string }>(`SELECT * FROM emails WHERE id = $1`, [id]);
  if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (email.status === "sent") return NextResponse.json({ error: "Cannot edit an email that was already sent" }, { status: 400 });

  const subject = typeof body.subject === "string" ? body.subject : undefined;
  const bodyText = typeof body.body === "string" ? body.body : undefined;

  await exec(`UPDATE emails SET subject = COALESCE($1, subject), body_text = COALESCE($2, body_text) WHERE id = $3`, [
    subject ?? null,
    bodyText ?? null,
    id,
  ]);

  await logAudit(email.candidate_id, "email_edited", { emailId: id });

  return NextResponse.json({ ok: true });
}
