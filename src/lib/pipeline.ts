import { randomUUID } from "node:crypto";
import { one, exec, named, logAudit } from "./db";
import { generateJson } from "./gemini";
import { sendDraftedEmail } from "./sendEmail";
import {
  SCORING_SYSTEM_PROMPT,
  buildScoringPrompt,
  GUARDRAIL_SYSTEM_PROMPT,
  buildGuardrailPrompt,
  BRIEF_SYSTEM_PROMPT,
  buildBriefPrompt,
  EMAIL_SYSTEM_PROMPT,
  buildEmailPrompt,
} from "./rubric";
import type { ScoringResult, GuardrailResult, InterviewBrief, EmailDraftBundle } from "./types";

export interface CandidateRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  filename: string;
  source: string;
  applied_role: string;
  resume_text: string;
  scrubbed_text: string;
  pipeline_status: string;
  pipeline_error: string | null;
}

async function getCandidate(id: string): Promise<CandidateRow> {
  const row = await one<CandidateRow>(`SELECT * FROM candidates WHERE id = $1`, [id]);
  if (!row) throw new Error(`Candidate not found: ${id}`);
  return row;
}

/** Step 1: score against the rubric for both roles. */
async function stepScore(candidate: CandidateRow): Promise<ScoringResult> {
  const prompt = buildScoringPrompt({
    candidateId: candidate.id,
    appliedRole: candidate.applied_role,
    scrubbedResume: candidate.scrubbed_text,
  });
  return generateJson<ScoringResult>({ system: SCORING_SYSTEM_PROMPT, prompt, temperature: 0.1 });
}

/** Step 2: guardrail + ranking review — catches good candidates the raw math would bury. */
async function stepGuardrail(scoring: ScoringResult): Promise<GuardrailResult> {
  const prompt = buildGuardrailPrompt(scoring);
  return generateJson<GuardrailResult>({ system: GUARDRAIL_SYSTEM_PROMPT, prompt, temperature: 0.1 });
}

/** Step 3: interview brief for the recommended role. */
async function stepBrief(scoring: ScoringResult, guardrail: GuardrailResult, recommendedRole: string): Promise<InterviewBrief> {
  const prompt = buildBriefPrompt({ scoring, guardrail, recommendedRole });
  return generateJson<InterviewBrief>({ system: BRIEF_SYSTEM_PROMPT, prompt, temperature: 0.2 });
}

/** Step 4: draft candidate-facing emails. */
async function stepEmails(params: {
  candidateName: string;
  recommendedRole: string;
  finalTier: "INTERVIEW" | "REVIEW" | "PASS";
  whyRankedHere: string;
  strengthsForInvite?: string[];
  forceKinds?: ("invite" | "rejection")[];
}): Promise<EmailDraftBundle> {
  const prompt = buildEmailPrompt(params);
  return generateJson<EmailDraftBundle>({ system: EMAIL_SYSTEM_PROMPT, prompt, temperature: 0.3 });
}

function recommendedComposite(scoring: ScoringResult) {
  return scoring.recommended_role === "PM" ? scoring.role_pm.composite : scoring.role_spm.composite;
}

function renderBriefMd(brief: InterviewBrief): string {
  return [
    `### Summary`,
    brief.summary,
    ``,
    `### Strengths`,
    ...brief.strengths.map((s) => `- ${s}`),
    ``,
    `### Risks & gaps to probe`,
    ...brief.risks_and_gaps.map((s) => `- ${s}`),
    ``,
    `### Probe questions`,
    ...brief.probe_questions.map((s) => `- ${s}`),
    ``,
    `### Suggested focus areas`,
    ...brief.suggested_focus_areas.map((s) => `- ${s}`),
  ].join("\n");
}

/**
 * Stage A: score + guardrail only (steps 1-2). Split out from the brief/email stage so
 * each stays comfortably inside a single serverless function's execution-time budget —
 * the full 4-step run can run past 40s, which is uncomfortably close to Vercel's Hobby
 * ceiling for one HTTP request.
 */
export async function runScoreStage(candidateId: string): Promise<{ scoring: ScoringResult; guardrail: GuardrailResult }> {
  const candidate = await getCandidate(candidateId);
  try {
    await exec(`UPDATE candidates SET pipeline_status = 'scoring', pipeline_error = NULL WHERE id = $1`, [candidateId]);

    const scoring = await stepScore(candidate);
    const guardrail = await stepGuardrail(scoring);
    const bestComposite = recommendedComposite(scoring);

    await named(
      `INSERT INTO scores (
        candidate_id, raw_json, pattern_score, role_score_pm, composite_pm, tier_pm,
        role_score_spm, composite_spm, tier_spm, recommended_role, reroute_suggested,
        experience_band_pm, experience_band_spm, why_ranked_here, probes_json,
        final_tier, potential_flag, potential_reason, guardrail_json, best_composite, updated_at
      ) VALUES (@candidate_id, @raw_json, @pattern_score, @role_score_pm, @composite_pm, @tier_pm,
        @role_score_spm, @composite_spm, @tier_spm, @recommended_role, @reroute_suggested,
        @experience_band_pm, @experience_band_spm, @why_ranked_here, @probes_json,
        @final_tier, @potential_flag, @potential_reason, @guardrail_json, @best_composite, now())
      ON CONFLICT(candidate_id) DO UPDATE SET
        raw_json=excluded.raw_json, pattern_score=excluded.pattern_score, role_score_pm=excluded.role_score_pm,
        composite_pm=excluded.composite_pm, tier_pm=excluded.tier_pm, role_score_spm=excluded.role_score_spm,
        composite_spm=excluded.composite_spm, tier_spm=excluded.tier_spm, recommended_role=excluded.recommended_role,
        reroute_suggested=excluded.reroute_suggested, experience_band_pm=excluded.experience_band_pm,
        experience_band_spm=excluded.experience_band_spm, why_ranked_here=excluded.why_ranked_here,
        probes_json=excluded.probes_json, final_tier=excluded.final_tier, potential_flag=excluded.potential_flag,
        potential_reason=excluded.potential_reason, guardrail_json=excluded.guardrail_json,
        best_composite=excluded.best_composite, updated_at=now()`,
      {
        candidate_id: candidateId,
        raw_json: JSON.stringify(scoring),
        pattern_score: scoring.pattern.pattern_score,
        role_score_pm: scoring.role_pm.role_score,
        composite_pm: scoring.role_pm.composite,
        tier_pm: scoring.role_pm.tier,
        role_score_spm: scoring.role_spm.role_score,
        composite_spm: scoring.role_spm.composite,
        tier_spm: scoring.role_spm.tier,
        recommended_role: scoring.recommended_role,
        reroute_suggested: scoring.reroute_suggested ? 1 : 0,
        experience_band_pm: scoring.experience_band_pm,
        experience_band_spm: scoring.experience_band_spm,
        why_ranked_here: scoring.why_ranked_here,
        probes_json: JSON.stringify(scoring.probes ?? []),
        final_tier: guardrail.final_tier,
        potential_flag: guardrail.potential_flag ? 1 : 0,
        potential_reason: guardrail.potential_reason ?? "",
        guardrail_json: JSON.stringify(guardrail),
        best_composite: bestComposite,
      }
    );

    await exec(`UPDATE candidates SET pipeline_status = 'scored' WHERE id = $1`, [candidateId]);
    await logAudit(candidateId, "scored", { tier: guardrail.final_tier, potential_flag: guardrail.potential_flag });

    return { scoring, guardrail };
  } catch (err) {
    const message = (err as Error).message;
    await exec(`UPDATE candidates SET pipeline_status = 'error', pipeline_error = $1 WHERE id = $2`, [message, candidateId]);
    await logAudit(candidateId, "error", { message });
    throw err;
  }
}

interface ScoreRow {
  raw_json: string;
  guardrail_json: string;
}

/**
 * Sets decision to 'reject' and sends the rejection email, but only when the candidate is
 * still 'pending' — never overwrites a human decision, including one that overrode a PASS
 * score by advancing them anyway.
 */
export async function autoRejectPassTier(candidateId: string, rejectionEmailId: string): Promise<void> {
  await exec(
    `UPDATE decisions SET decision = 'reject', decided_at = now()
     WHERE candidate_id = $1 AND decision = 'pending'`,
    [candidateId]
  );
  const current = await one<{ decision: string }>(`SELECT decision FROM decisions WHERE candidate_id = $1`, [candidateId]);
  if (current?.decision !== "reject") return; // a human had already made a call — leave it alone

  const outcome = await sendDraftedEmail(rejectionEmailId);
  await logAudit(candidateId, "auto_rejected_pass_tier", { emailId: rejectionEmailId, ok: outcome.ok, error: outcome.error });
}

/** Stage B: interview brief + email drafts (steps 3-4). Requires runScoreStage to have run first. */
export async function runFinishStage(candidateId: string): Promise<void> {
  const candidate = await getCandidate(candidateId);
  const scoreRow = await one<ScoreRow>(`SELECT raw_json, guardrail_json FROM scores WHERE candidate_id = $1`, [candidateId]);
  if (!scoreRow) throw new Error(`No score found for ${candidateId} — run the score stage first.`);

  const scoring: ScoringResult = JSON.parse(scoreRow.raw_json);
  const guardrail: GuardrailResult = JSON.parse(scoreRow.guardrail_json);

  try {
    const strengthsSource = scoring.recommended_role === "PM" ? scoring.role_pm.criteria : scoring.role_spm.criteria;
    const strengths = Object.values(strengthsSource)
      .filter((c) => c.score >= 3)
      .map((c) => c.evidence)
      .slice(0, 3);

    if (guardrail.final_tier === "INTERVIEW" || guardrail.final_tier === "REVIEW") {
      const brief = await stepBrief(scoring, guardrail, scoring.recommended_role);
      const contentMd = renderBriefMd(brief);
      await exec(
        `INSERT INTO briefs (candidate_id, content_md, updated_at) VALUES ($1, $2, now())
         ON CONFLICT(candidate_id) DO UPDATE SET content_md = excluded.content_md, updated_at = now()`,
        [candidateId, contentMd]
      );
    }

    const emailBundle = await stepEmails({
      candidateName: candidate.name,
      recommendedRole: scoring.recommended_role,
      finalTier: guardrail.final_tier,
      whyRankedHere: scoring.why_ranked_here,
      strengthsForInvite: strengths,
    });

    await exec(`DELETE FROM emails WHERE candidate_id = $1 AND status = 'drafted'`, [candidateId]);
    let rejectionEmailId: string | null = null;
    for (const email of emailBundle.emails) {
      const emailId = randomUUID();
      if (email.kind === "rejection") rejectionEmailId = emailId;
      await exec(
        `INSERT INTO emails (id, candidate_id, kind, subject, body_text, status, to_email, created_at)
         VALUES ($1, $2, $3, $4, $5, 'drafted', $6, now())`,
        [emailId, candidateId, email.kind, email.subject, email.body, candidate.email]
      );
    }

    await exec(`UPDATE candidates SET pipeline_status = 'drafted' WHERE id = $1`, [candidateId]);
    await exec(
      `INSERT INTO decisions (candidate_id, decision) VALUES ($1, 'pending')
       ON CONFLICT(candidate_id) DO NOTHING`,
      [candidateId]
    );
    await logAudit(candidateId, "drafted", { emails: emailBundle.emails.map((e) => e.kind) });

    // PASS tier means the system itself decided this candidate isn't a fit against the hire
    // pattern — send the rejection right away, no human click. This only fires when nobody
    // has made a decision on this candidate yet, so it can never overwrite an Advance/Reject
    // Arjun already made by hand (e.g. overriding a PASS score).
    if (guardrail.final_tier === "PASS" && rejectionEmailId) {
      await autoRejectPassTier(candidateId, rejectionEmailId);
    }
  } catch (err) {
    const message = (err as Error).message;
    await exec(`UPDATE candidates SET pipeline_status = 'error', pipeline_error = $1 WHERE id = $2`, [message, candidateId]);
    await logAudit(candidateId, "error", { message });
    throw err;
  }
}

/** Full run (both stages) — used by the CLI bulk-scoring script and the single-candidate "re-run" button. */
export async function runPipelineForCandidate(candidateId: string): Promise<void> {
  await runScoreStage(candidateId);
  await runFinishStage(candidateId);
}

async function loadScoring(candidateId: string): Promise<{ scoring: ScoringResult; guardrail: GuardrailResult }> {
  const scoreRow = await one<ScoreRow>(`SELECT raw_json, guardrail_json FROM scores WHERE candidate_id = $1`, [candidateId]);
  if (!scoreRow) throw new Error(`No score found for ${candidateId} — score it before drafting an email.`);
  return { scoring: JSON.parse(scoreRow.raw_json), guardrail: JSON.parse(scoreRow.guardrail_json) };
}

export interface EmailRow {
  id: string;
  candidate_id: string;
  kind: string;
  subject: string;
  body_text: string;
  status: string;
  to_email: string | null;
  error: string | null;
}

/**
 * Returns the most recent draft/sent email of `kind` for a candidate, generating one on
 * demand if it doesn't exist yet — e.g. Arjun advances a PASS-tier candidate by hand, who
 * only ever had a rejection drafted, so no invite exists until this generates one.
 */
export async function ensureEmailDraft(candidateId: string, kind: "invite" | "rejection"): Promise<EmailRow> {
  const existing = await one<EmailRow>(
    `SELECT * FROM emails WHERE candidate_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT 1`,
    [candidateId, kind]
  );
  if (existing) return existing;

  const candidate = await getCandidate(candidateId);
  const { scoring, guardrail } = await loadScoring(candidateId);
  const strengthsSource = scoring.recommended_role === "PM" ? scoring.role_pm.criteria : scoring.role_spm.criteria;
  const strengths = Object.values(strengthsSource)
    .filter((c) => c.score >= 3)
    .map((c) => c.evidence)
    .slice(0, 3);

  const bundle = await stepEmails({
    candidateName: candidate.name,
    recommendedRole: scoring.recommended_role,
    finalTier: guardrail.final_tier,
    whyRankedHere: scoring.why_ranked_here,
    strengthsForInvite: strengths,
    forceKinds: [kind],
  });
  const email = bundle.emails.find((e) => e.kind === kind) ?? bundle.emails[0];
  const id = randomUUID();
  await exec(
    `INSERT INTO emails (id, candidate_id, kind, subject, body_text, status, to_email, created_at)
     VALUES ($1, $2, $3, $4, $5, 'drafted', $6, now())`,
    [id, candidateId, email.kind, email.subject, email.body, candidate.email]
  );
  await logAudit(candidateId, "email_drafted_on_demand", { kind });
  const row = await one<EmailRow>(`SELECT * FROM emails WHERE id = $1`, [id]);
  if (!row) throw new Error("Failed to read back the email draft just inserted.");
  return row;
}

/** Re-drafts invite/rejection emails with the current prompt, without re-scoring or re-briefing.
 * Leaves already-SENT emails untouched — only replaces ones still sitting at 'drafted'. */
export async function regenerateDraftedEmails(candidateId: string): Promise<void> {
  const candidate = await getCandidate(candidateId);
  const { scoring, guardrail } = await loadScoring(candidateId);
  const strengthsSource = scoring.recommended_role === "PM" ? scoring.role_pm.criteria : scoring.role_spm.criteria;
  const strengths = Object.values(strengthsSource)
    .filter((c) => c.score >= 3)
    .map((c) => c.evidence)
    .slice(0, 3);

  const emailBundle = await stepEmails({
    candidateName: candidate.name,
    recommendedRole: scoring.recommended_role,
    finalTier: guardrail.final_tier,
    whyRankedHere: scoring.why_ranked_here,
    strengthsForInvite: strengths,
  });

  const alreadySentKinds = (await one<{ kinds: string[] }>(
    `SELECT COALESCE(array_agg(kind), '{}') as kinds FROM emails WHERE candidate_id = $1 AND status = 'sent'`,
    [candidateId]
  ))?.kinds ?? [];

  await exec(`DELETE FROM emails WHERE candidate_id = $1 AND status = 'drafted'`, [candidateId]);
  for (const email of emailBundle.emails) {
    if (alreadySentKinds.includes(email.kind)) continue; // don't draft a duplicate of one already sent
    await exec(
      `INSERT INTO emails (id, candidate_id, kind, subject, body_text, status, to_email, created_at)
       VALUES ($1, $2, $3, $4, $5, 'drafted', $6, now())`,
      [randomUUID(), candidateId, email.kind, email.subject, email.body, candidate.email]
    );
  }
  await logAudit(candidateId, "emails_redrafted", { kinds: emailBundle.emails.map((e) => e.kind) });
}
