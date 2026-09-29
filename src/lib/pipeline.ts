import { randomUUID } from "node:crypto";
import { one, exec, named, logAudit } from "./db";
import { generateJson } from "./gemini";
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

/** Step 4: draft candidate-facing emails (never sent automatically). */
async function stepEmails(params: {
  candidateName: string;
  recommendedRole: string;
  finalTier: "INTERVIEW" | "REVIEW" | "PASS";
  whyRankedHere: string;
  strengthsForInvite?: string[];
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
    for (const email of emailBundle.emails) {
      await exec(
        `INSERT INTO emails (id, candidate_id, kind, subject, body_text, status, to_email, created_at)
         VALUES ($1, $2, $3, $4, $5, 'drafted', $6, now())`,
        [randomUUID(), candidateId, email.kind, email.subject, email.body, candidate.email]
      );
    }

    await exec(`UPDATE candidates SET pipeline_status = 'drafted' WHERE id = $1`, [candidateId]);
    await exec(
      `INSERT INTO decisions (candidate_id, decision) VALUES ($1, 'pending')
       ON CONFLICT(candidate_id) DO NOTHING`,
      [candidateId]
    );
    await logAudit(candidateId, "drafted", { emails: emailBundle.emails.map((e) => e.kind) });
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
