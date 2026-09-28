import { NextResponse } from "next/server";
import { one, exec, logAudit } from "@/lib/db";
import { getResend, FROM_EMAIL } from "@/lib/resend";

interface EmailRow {
  id: string;
  candidate_id: string;
  kind: string;
  subject: string;
  body_text: string;
  status: string;
  to_email: string | null;
}

// This route only ever runs after a human click on the candidate page — never from the
// pipeline itself. That's the one thing in this app that is never automatic.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await one<EmailRow>(`SELECT * FROM emails WHERE id = $1`, [id]);
  if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (email.status === "sent") return NextResponse.json({ error: "Already sent" }, { status: 400 });
  if (!email.to_email) return NextResponse.json({ error: "No email address on file for this candidate" }, { status: 400 });

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email.to_email,
      subject: email.subject,
      text: email.body_text,
    });

    if (result.error) {
      await exec(`UPDATE emails SET status = 'failed', error = $1 WHERE id = $2`, [result.error.message, id]);
      await logAudit(email.candidate_id, "email_send_failed", { emailId: id, error: result.error.message });
      return NextResponse.json({ error: result.error.message }, { status: 502 });
    }

    await exec(`UPDATE emails SET status = 'sent', resend_id = $1, sent_at = now(), error = NULL WHERE id = $2`, [
      result.data?.id ?? null,
      id,
    ]);
    await logAudit(email.candidate_id, "email_sent", { emailId: id, kind: email.kind, to: email.to_email });

    return NextResponse.json({ ok: true, resendId: result.data?.id });
  } catch (e) {
    const message = (e as Error).message;
    await exec(`UPDATE emails SET status = 'failed', error = $1 WHERE id = $2`, [message, id]);
    await logAudit(email.candidate_id, "email_send_failed", { emailId: id, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
