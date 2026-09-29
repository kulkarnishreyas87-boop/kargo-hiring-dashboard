import { one, exec, logAudit } from "./db";
import { getResend, FROM_EMAIL } from "./resend";
import type { EmailRow } from "./pipeline";

export interface SendResult {
  ok: boolean;
  resendId?: string;
  error?: string;
}

/** Sends a single drafted email by id via Resend and records the outcome. Idempotent:
 * calling it on an already-sent email is a no-op success, never a duplicate send. */
export async function sendDraftedEmail(emailId: string): Promise<SendResult> {
  const email = await one<EmailRow>(`SELECT * FROM emails WHERE id = $1`, [emailId]);
  if (!email) return { ok: false, error: "Not found" };
  if (email.status === "sent") return { ok: true }; // already sent, nothing to do
  if (!email.to_email) return { ok: false, error: "No email address on file for this candidate" };

  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email.to_email,
      subject: email.subject,
      text: email.body_text,
    });

    if (result.error) {
      await exec(`UPDATE emails SET status = 'failed', error = $1 WHERE id = $2`, [result.error.message, emailId]);
      await logAudit(email.candidate_id, "email_send_failed", { emailId, error: result.error.message });
      return { ok: false, error: result.error.message };
    }

    await exec(`UPDATE emails SET status = 'sent', resend_id = $1, sent_at = now(), error = NULL WHERE id = $2`, [
      result.data?.id ?? null,
      emailId,
    ]);
    await logAudit(email.candidate_id, "email_sent", { emailId, kind: email.kind, to: email.to_email });
    return { ok: true, resendId: result.data?.id };
  } catch (e) {
    const message = (e as Error).message;
    await exec(`UPDATE emails SET status = 'failed', error = $1 WHERE id = $2`, [message, emailId]);
    await logAudit(email.candidate_id, "email_send_failed", { emailId, error: message });
    return { ok: false, error: message };
  }
}
