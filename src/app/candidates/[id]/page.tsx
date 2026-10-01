"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";

interface Criterion {
  score: number;
  evidence: string;
  confidence: string;
}

interface ScoringRaw {
  pattern: { P1: Criterion; P2: Criterion; P3: Criterion; P4: Criterion; pattern_score: number };
  role_pm: { criteria: Record<string, Criterion>; role_score: number; composite: number; tier: string };
  role_spm: { criteria: Record<string, Criterion>; role_score: number; composite: number; tier: string };
  recommended_role: string;
  reroute_suggested: boolean;
  experience_band_pm: string;
  experience_band_spm: string;
  why_ranked_here: string;
  applied_role: string;
}

interface EmailRow {
  id: string;
  kind: string;
  subject: string;
  body_text: string;
  status: string;
  to_email: string | null;
  error: string | null;
  sent_at: string | null;
}

interface Detail {
  candidate: { id: string; name: string; email: string | null; applied_role: string; pipeline_status: string; pipeline_error: string | null };
  score: (Record<string, unknown> & { raw: ScoringRaw; guardrail: { potential_flag: boolean; potential_reason: string; final_tier: string; guardrail_notes: string }; probes: string[] }) | null;
  brief: { content_md: string } | null;
  emails: EmailRow[];
  decision: { decision: string; note: string | null };
}

const PATTERN_LABELS: Record<string, string> = {
  P1: "Ground-level operations exposure",
  P2: "Built unasked, adopted by peers",
  P3: "Ownership without a layer",
  P4: "Holds under operational pressure",
};
const ROLE_LABELS: Record<string, string> = {
  PM1: "Ships in short cycles, unprompted adoption",
  PM2: "Shipped, killed, learned",
  PM3: "Discovery inside customer workflows",
  PM4: "Built PM rhythms from zero",
  SPM1: "Integration / platform / data-layer ownership",
  SPM2: "Owned an area with no senior PM above",
  SPM3: "Integrations tied to revenue; cross-functional",
  SPM4: "Early-stage / unwritten rules; shaped practice",
  SPM5: "Reliability and data-quality standards",
};

function ScoreDot({ score }: { score: number }) {
  const color = score >= 3 ? "bg-emerald-500" : score === 2 ? "bg-amber-400" : score === 1 ? "bg-orange-400" : "bg-slate-300";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} mr-2 align-middle`} />;
}

function CriteriaTable({ criteria, labels }: { criteria: Record<string, Criterion>; labels: Record<string, string> }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {Object.entries(criteria).map(([key, c]) => (
          <tr key={key} className="border-t border-slate-100 align-top">
            <td className="py-2 pr-3 w-56">
              <div className="font-medium text-slate-800">
                <ScoreDot score={c.score} />
                {key} · {labels[key] ?? key}
              </div>
              <div className="text-xs text-slate-400 pl-4.5">
                {c.score}/4 · {c.confidence} confidence
              </div>
            </td>
            <td className="py-2 text-slate-600">{c.evidence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [note, setNote] = useState("");
  const [resultModal, setResultModal] = useState<{ ok: boolean; title: string; message: string } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/candidates/${id}`, { cache: "no-store" });
    const json: Detail = await res.json();
    setData(json);
    setNote(json.decision?.note ?? "");
    const d: Record<string, { subject: string; body: string }> = {};
    for (const e of json.emails ?? []) d[e.id] = { subject: e.subject, body: e.body_text };
    setDrafts(d);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function setDecision(decision: string) {
    setBusy("decision");
    const res = await fetch(`/api/candidates/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    const json = await res.json().catch(() => null);
    if (json?.email?.attempted) {
      const kindLabel = json.email.kind === "invite" ? "Interview invite" : "Rejection email";
      setResultModal(
        json.email.ok
          ? { ok: true, title: "Email has been sent", message: `${kindLabel} was delivered to ${data?.candidate.email ?? "the candidate"}.` }
          : { ok: false, title: "Email was not sent", message: `${kindLabel} failed to send: ${json.email.error ?? "unknown error"}` }
      );
    }
    await load();
    setBusy(null);
  }

  async function saveDraft(emailId: string) {
    setBusy(emailId);
    const d = drafts[emailId];
    await fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: d.subject, body: d.body }),
    });
    await load();
    setBusy(null);
  }

  async function sendEmail(emailId: string) {
    setBusy(emailId);
    await saveDraft(emailId);
    const res = await fetch(`/api/emails/${emailId}/send`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setResultModal({ ok: false, title: "Email was not sent", message: j.error ?? res.statusText ?? "Unknown error" });
    } else {
      const toEmail = data?.emails.find((e) => e.id === emailId)?.to_email;
      setResultModal({ ok: true, title: "Email has been sent", message: `Delivered to ${toEmail ?? "the candidate"}.` });
    }
    setConfirmSendId(null);
    await load();
    setBusy(null);
  }

  async function rerun() {
    setBusy("rerun");
    // Split into two requests (score+guardrail, then brief+emails) so neither one
    // gets close to the serverless function time limit.
    const scoreRes = await fetch(`/api/candidates/${id}/rerun/score`, { method: "POST" });
    if (!scoreRes.ok) {
      const j = await scoreRes.json().catch(() => ({}));
      alert("Scoring failed: " + (j.error ?? scoreRes.statusText));
      setBusy(null);
      return;
    }
    const finishRes = await fetch(`/api/candidates/${id}/rerun/finish`, { method: "POST" });
    if (!finishRes.ok) {
      const j = await finishRes.json().catch(() => ({}));
      alert("Brief/email generation failed: " + (j.error ?? finishRes.statusText));
    }
    await load();
    setBusy(null);
  }

  if (loading || !data) return <div className="text-slate-400">Loading…</div>;

  const { candidate, score, brief, emails } = data;
  const raw = score?.raw;
  const sentEmail = emails.find((e) => e.status === "sent");
  const advanceLocked = sentEmail?.kind === "invite";
  const rejectLocked = sentEmail?.kind === "rejection";

  return (
    <div className="space-y-6 pb-16">
      <Modal
        open={!!resultModal}
        onClose={() => setResultModal(null)}
        title={resultModal?.title ?? ""}
        tone={resultModal?.ok ? "success" : "error"}
        actionLabel={resultModal?.ok ? "Back to shortlist" : "OK"}
        onAction={() => {
          const wasOk = resultModal?.ok;
          setResultModal(null);
          if (wasOk) router.push("/");
        }}
      >
        {resultModal?.message}
      </Modal>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-700">
            ← Back to shortlist
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{candidate.name}</h1>
          <p className="text-slate-500 text-sm">
            Applied: {candidate.applied_role} · {candidate.email ?? "no email on file"}
          </p>
        </div>
        <button
          onClick={rerun}
          disabled={busy === "rerun"}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
        >
          {busy === "rerun" ? "Re-running…" : "Re-run pipeline"}
        </button>
      </div>

      {candidate.pipeline_status === "error" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-sm px-4 py-3">
          Pipeline error: {candidate.pipeline_error}
        </div>
      )}

      {!score && candidate.pipeline_status !== "error" && (
        <div className="rounded-md border border-slate-200 bg-white text-slate-500 text-sm px-4 py-3">
          Not scored yet. Run the pipeline from the dashboard banner, or click &ldquo;Re-run pipeline&rdquo; above.
        </div>
      )}

      {score && raw && (
        <>
          {score.guardrail.potential_flag && (
            <div className="rounded-md border border-violet-200 bg-violet-50 text-violet-800 text-sm px-4 py-3">
              <span className="font-medium">High-potential override.</span> {score.guardrail.potential_reason}
            </div>
          )}
          {score.guardrail.guardrail_notes && !score.guardrail.potential_flag && (
            <div className="rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-sm px-4 py-3">
              {score.guardrail.guardrail_notes}
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Recommended role</div>
              <div className="text-lg font-semibold mt-1">
                {raw.recommended_role} {raw.reroute_suggested && <span className="text-xs text-indigo-600 font-normal">(reroute from {raw.applied_role})</span>}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Final tier</div>
              <div className="text-lg font-semibold mt-1">{score.guardrail.final_tier}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-400 uppercase tracking-wide">Pattern score</div>
              <div className="text-lg font-semibold mt-1">{raw.pattern.pattern_score.toFixed(1)} / 100</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Why ranked here</div>
            <p className="text-base font-medium text-slate-900">{raw.why_ranked_here}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-medium mb-2">Layer A — Hire pattern (60% of composite)</h2>
            <CriteriaTable criteria={{ P1: raw.pattern.P1, P2: raw.pattern.P2, P3: raw.pattern.P3, P4: raw.pattern.P4 }} labels={PATTERN_LABELS} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-medium mb-1">Product Manager fit</h2>
              <p className="text-xs text-slate-400 mb-2">
                Composite {raw.role_pm.composite.toFixed(1)} · Tier {raw.role_pm.tier} · Experience band: {raw.experience_band_pm}
              </p>
              <CriteriaTable criteria={raw.role_pm.criteria} labels={ROLE_LABELS} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-medium mb-1">Senior PM fit</h2>
              <p className="text-xs text-slate-400 mb-2">
                Composite {raw.role_spm.composite.toFixed(1)} · Tier {raw.role_spm.tier} · Experience band: {raw.experience_band_spm}
              </p>
              <CriteriaTable criteria={raw.role_spm.criteria} labels={ROLE_LABELS} />
            </div>
          </div>

          {score.probes?.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-medium mb-2">Probe questions from scoring</h2>
              <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                {score.probes.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {brief && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-medium mb-2">Interview brief</h2>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-slate-900">{brief.content_md}</div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="font-medium">Shortlist decision (human — the last thing you touch)</h2>
            <p className="text-xs text-slate-500">
              Advance sends the interview invite immediately. Reject sends the rejection immediately. Both go straight to{" "}
              {candidate.email ?? "the candidate's email"} the moment you click, no extra confirmation.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for your own record…"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900"
              rows={2}
            />
            <div className="flex gap-2 flex-wrap">
              {advanceLocked ? (
                <span className="rounded-md px-3 py-1.5 text-sm border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5">
                  ✓ Invite sent
                </span>
              ) : (
                <button
                  onClick={() => setDecision("advance")}
                  disabled={busy === "decision"}
                  className={`rounded-md px-3 py-1.5 text-sm border transition-colors disabled:opacity-50 ${
                    data.decision.decision === "advance" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {busy === "decision" ? "Working…" : "Advance"}
                </button>
              )}
              {rejectLocked ? (
                <span className="rounded-md px-3 py-1.5 text-sm border bg-rose-50 text-rose-700 border-rose-200 flex items-center gap-1.5">
                  ✓ Rejection sent
                </span>
              ) : (
                <button
                  onClick={() => setDecision("reject")}
                  disabled={busy === "decision"}
                  className={`rounded-md px-3 py-1.5 text-sm border transition-colors disabled:opacity-50 ${
                    data.decision.decision === "reject" ? "bg-rose-600 text-white border-rose-600" : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {busy === "decision" ? "Working…" : "Reject"}
                </button>
              )}
              <button
                onClick={() => setDecision("pending")}
                disabled={busy === "decision" || data.decision.decision === "pending"}
                title={sentEmail ? "Resets your tracking only — it can't unsend the email already delivered." : undefined}
                className={`rounded-md px-3 py-1.5 text-sm border transition-colors disabled:opacity-50 ${
                  data.decision.decision === "pending" ? "bg-slate-700 text-white border-slate-700" : "border-slate-300 hover:bg-slate-100"
                }`}
              >
                Back to pending
              </button>
            </div>
            {sentEmail && (
              <p className="text-xs text-slate-400">
                An email has already gone out to this candidate, so the decision is locked in. Edit the draft below and
                use its own Send button if you need to follow up separately.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-medium">Draft emails</h2>
            <p className="text-xs text-slate-500 -mt-2">
              These send automatically when you Advance or Reject above. You can also edit and send one manually here anytime.
            </p>
            {emails.length === 0 && <p className="text-sm text-slate-400">No drafts yet.</p>}
            {emails.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    {e.kind === "invite" ? "Interview invite" : "Rejection"}
                  </span>
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 border ${
                      e.status === "sent"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : e.status === "failed"
                        ? "bg-rose-100 text-rose-700 border-rose-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
                <input
                  value={drafts[e.id]?.subject ?? ""}
                  onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: { ...d[e.id], subject: ev.target.value } }))}
                  disabled={e.status === "sent"}
                  className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium text-slate-900 disabled:bg-slate-50 disabled:text-slate-700"
                />
                <textarea
                  value={drafts[e.id]?.body ?? ""}
                  onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: { ...d[e.id], body: ev.target.value } }))}
                  disabled={e.status === "sent"}
                  rows={7}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-700"
                />
                {e.error && <p className="text-xs text-rose-600">Last error: {e.error}</p>}
                {sentEmail && e.id !== sentEmail.id && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    The {sentEmail.kind} already went out to this candidate — sending this {e.kind} too would contradict
                    it, so it&apos;s locked. Clear the decision above first if you really need to send this instead.
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>To: {e.to_email ?? "no email on file"}</span>
                  <span className="ml-auto" />
                  {e.status !== "sent" && !(sentEmail && e.id !== sentEmail.id) && (
                    <>
                      <button
                        onClick={() => saveDraft(e.id)}
                        disabled={busy === e.id}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        Save draft
                      </button>
                      {confirmSendId === e.id ? (
                        <span className="flex items-center gap-2">
                          <span className="text-rose-600">Send to {e.to_email}?</span>
                          <button
                            onClick={() => sendEmail(e.id)}
                            disabled={busy === e.id}
                            className="rounded-md bg-rose-600 text-white px-3 py-1.5"
                          >
                            {busy === e.id ? "Sending…" : "Confirm send"}
                          </button>
                          <button onClick={() => setConfirmSendId(null)} className="rounded-md border border-slate-300 px-3 py-1.5">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmSendId(e.id)}
                          disabled={!e.to_email}
                          className="rounded-md bg-slate-900 text-white px-3 py-1.5 disabled:opacity-40"
                        >
                          Send
                        </button>
                      )}
                    </>
                  )}
                  {e.status === "sent" && e.sent_at && <span>Sent {e.sent_at}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
