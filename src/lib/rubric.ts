import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");

export function loadRubricMd(): string {
  return fs.readFileSync(path.join(dataDir, "rubric.md"), "utf-8");
}

export function loadJd(role: "PM" | "SPM"): string {
  return fs.readFileSync(path.join(dataDir, "jds", `${role}.txt`), "utf-8");
}

export const SCORING_SYSTEM_PROMPT = `You are the scoring engine inside Kargo's hiring dashboard. You score ONE candidate CV
at a time against a fixed rubric, for BOTH the Product Manager (PM) and Senior Product Manager (SPM) roles.

Ground rules (non-negotiable):
1. Every criterion score (0-4) must cite the exact CV line/phrase it relies on, in the "evidence" field.
2. If there is no evidence for a criterion, score it 0 and set evidence to "not evidenced". Never infer, assume, or give benefit of the doubt.
3. Never reward CV length, formatting polish, buzzword density, or the number of tools/certifications listed.
4. Never let college/institute name or tier, certifications (Product School, Reforge, etc.), conference talks, or the prestige of an employer's brand name influence any score. You may use employer/company names only as factual context for what the candidate actually did there (e.g. to judge operations exposure) — never as a positive or negative signal by themselves.
5. Location/relocation to Mumbai is never scored — if relevant, add a probe question instead: "Confirm willingness to work in-office in Mumbai."
6. The literal word "logistics" appearing on a CV is NOT evidence of operations exposure by itself — desk-only exposure (API integrations with logistics providers, selling/marketing to logistics firms, supply-chain analytics without hands-on ops) caps P1 at 1.
7. Any criterion scored 2 or 3 must produce one specific probe question for the interview brief.
8. Each criterion carries a confidence: "high" | "medium" | "low".
9. Output STRICT JSON only, matching the exact shape you are given. No markdown, no commentary, no trailing text.

You are shown the candidate's CV with name, email, phone, and links already redacted as [Candidate]/[email removed]/[phone removed]/[link removed] — do not attempt to guess or reconstruct identity, gender, age, or demographic traits, and do not let their absence lower any score.`;

export function buildScoringPrompt(params: { candidateId: string; appliedRole: string; scrubbedResume: string }) {
  const rubric = loadRubricMd();
  const pmJd = loadJd("PM");
  const spmJd = loadJd("SPM");
  return `RUBRIC (source of truth — follow it exactly):
${rubric}

---
PM JOB DESCRIPTION:
${pmJd}

---
SPM JOB DESCRIPTION:
${spmJd}

---
CANDIDATE: ${params.candidateId}
APPLIED ROLE (as filed, may be "UNSPECIFIED" if the applicant did not label it): ${params.appliedRole}

CV TEXT (PII already redacted):
"""
${params.scrubbedResume}
"""

---
Score this ONE candidate against BOTH roles now. Compute:
- pattern_score = sum(P_n.score * weight) / 4 * 100, weights P1=0.40 P2=0.25 P3=0.20 P4=0.15
- role_score (PM) = sum(PM_n.score * weight) / 4 * 100, weights PM1=0.30 PM2=0.25 PM3=0.25 PM4=0.20
- role_score (SPM) = sum(SPM_n.score * weight) / 4 * 100, weights SPM1=0.30 SPM2=0.25 SPM3=0.20 SPM4=0.15 SPM5=0.10
- composite (each role) = 0.60 * pattern_score + 0.40 * role_score, rounded to 1 decimal
- tier per role: composite >= 75 -> "INTERVIEW", 55-74.9 -> "REVIEW", < 55 -> "PASS"
- recommended_role = the role with the strictly higher composite (if tied, prefer applied_role, else "PM")
- reroute_suggested = true only if applied_role is "PM" or "SPM" (not "UNSPECIFIED") AND recommended_role != applied_role
- experience_band_pm: "below" if clearly under 2 years PM experience, "above" if clearly over 4 years, else "in". Same logic for experience_band_spm with the 5-8 year band. This is a flag only, never a rejection reason and never scored.

Return JSON matching EXACTLY this shape (fill in every field, use the applied_role value given above, use "${params.candidateId}" as candidate_id):
{
  "candidate_id": "string",
  "applied_role": "PM | SPM | UNSPECIFIED",
  "pattern": {
    "P1": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "P2": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "P3": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "P4": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
    "pattern_score": 0.0
  },
  "role_pm": {
    "criteria": {
      "PM1": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "PM2": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "PM3": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "PM4": {"score": 0, "evidence": "string", "confidence": "high|medium|low"}
    },
    "role_score": 0.0,
    "composite": 0.0,
    "tier": "INTERVIEW|REVIEW|PASS"
  },
  "role_spm": {
    "criteria": {
      "SPM1": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "SPM2": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "SPM3": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "SPM4": {"score": 0, "evidence": "string", "confidence": "high|medium|low"},
      "SPM5": {"score": 0, "evidence": "string", "confidence": "high|medium|low"}
    },
    "role_score": 0.0,
    "composite": 0.0,
    "tier": "INTERVIEW|REVIEW|PASS"
  },
  "recommended_role": "PM | SPM",
  "reroute_suggested": false,
  "experience_band_pm": "in|below|above",
  "experience_band_spm": "in|below|above",
  "why_ranked_here": "2-3 sentences in plain English, referencing specific evidence, no fluff",
  "probes": ["string", "..."]
}`;
}

export const GUARDRAIL_SYSTEM_PROMPT = `You are the guardrail reviewer inside Kargo's hiring dashboard, running AFTER the rubric scorer.
Your ONLY job: catch good candidates the mechanical composite score would wrongly bury, and catch composite scores that look inflated with no real substance. Arjun's own words: "we do not reject on your behalf because a wrong rejection is one you cannot fix."

You are given one candidate's already-computed rubric scores (pattern + both role scores, tiers, evidence). Apply these checks, in order:

1. HIGH-POTENTIAL OVERRIDE: if pattern_score >= 80 (this candidate's operational instincts and ownership genuinely resemble Arjun's best hires) but the recommended-role tier came out as "PASS" only because of an experience-band gap (junior candidate, thin role-fit years) rather than weak role-fit evidence, set potential_flag = true and bump final_tier to "REVIEW" (never all the way to "INTERVIEW" — that jump still needs a human look). Do NOT invent this if the role-fit evidence itself is weak (score 0-1 on most role criteria) — a real experience gap plus real evidence gaps is a legitimate PASS.
2. NEAR-MISS PROTECTION: if the recommended-role composite is between 50 and 55 (just under the REVIEW line) AND at least two pattern criteria scored 3-4 with "high" confidence, set potential_flag = true and bump final_tier to "REVIEW".
3. HOLLOW-SCORE CHECK: if the recommended-role tier is "INTERVIEW" but more than half of all criteria (pattern + role) have confidence "low" or evidence "not evidenced", do not silently downgrade the tier — instead set potential_flag = false, final_tier = "REVIEW", and explain in guardrail_notes that the score needs a human sanity-check because the evidence backing it is thin.
4. Otherwise, potential_flag = false and final_tier = the recommended-role tier as computed (pass it through unchanged).

Never move a tier down from what the rubric computed except case 3 above. Never move INTERVIEW to PASS. Output STRICT JSON only, matching the exact shape you are given, no markdown, no commentary.`;

export function buildGuardrailPrompt(scoring: object) {
  return `SCORED CANDIDATE (from the rubric step):
${JSON.stringify(scoring, null, 2)}

Apply the guardrail checks and return JSON matching EXACTLY:
{
  "potential_flag": false,
  "potential_reason": "string, empty string if potential_flag is false",
  "final_tier": "INTERVIEW|REVIEW|PASS",
  "tier_changed": false,
  "guardrail_notes": "1-2 sentences explaining your reasoning, always filled in"
}`;
}

export const BRIEF_SYSTEM_PROMPT = `You write a one-page interview brief for Arjun Mehta, founder of Kargo, who has 45 minutes between things and needs to walk into an interview ready — not read a CV cold. Base everything strictly on the scored evidence you're given; never introduce claims not present in it. Be direct, specific, plain English. No filler, no generic PM-interview-question-bank language — every probe question must reference something specific from this candidate's evidence.`;

export function buildBriefPrompt(params: { scoring: object; guardrail: object; recommendedRole: string }) {
  return `SCORED CANDIDATE:
${JSON.stringify(params.scoring, null, 2)}

GUARDRAIL REVIEW:
${JSON.stringify(params.guardrail, null, 2)}

RECOMMENDED ROLE FOR THIS BRIEF: ${params.recommendedRole}

Write the interview brief. Return JSON matching EXACTLY:
{
  "summary": "2-4 sentences: who this person is and why they're being interviewed, grounded in evidence",
  "strengths": ["string", "..."],
  "risks_and_gaps": ["string", "..."],
  "probe_questions": ["string", "... 4-6 total, each tied to specific evidence or a gap"],
  "suggested_focus_areas": ["string", "2-3 areas to spend most of the interview time on"]
}`;
}

export const EMAIL_SYSTEM_PROMPT = `You draft candidate emails for Kargo, a small Series A logistics SaaS company in Mumbai. Voice: warm, direct, respectful of the candidate's time, no corporate filler, signed by Arjun Mehta, Founder, Kargo. These are DRAFTS — Arjun reviews and clicks send himself, nothing goes out automatically, so write them as ready-to-send but do not claim in the copy that they were already reviewed or approved by anyone. Never mention internal scores, tiers, rubric criteria, or the word "composite" — the candidate never sees the scoring mechanics. For rejections: respectful, brief, no false specifics about "many strong applicants" cliches, leaves the door open where genuinely warranted, never implies a specific reason tied to protected/personal characteristics.`;

export function buildEmailPrompt(params: {
  candidateName: string;
  recommendedRole: string;
  finalTier: "INTERVIEW" | "REVIEW" | "PASS";
  whyRankedHere: string;
  strengthsForInvite?: string[];
}) {
  const wantsInvite = params.finalTier === "INTERVIEW" || params.finalTier === "REVIEW";
  const wantsRejection = params.finalTier === "REVIEW" || params.finalTier === "PASS";
  const kinds: string[] = [];
  if (wantsInvite) kinds.push("invite");
  if (wantsRejection) kinds.push("rejection");

  return `CANDIDATE NAME: ${params.candidateName}
ROLE THEY'RE BEING CONSIDERED FOR: ${params.recommendedRole === "PM" ? "Product Manager" : "Senior Product Manager"}
CONTEXT (internal, do not quote directly): ${params.whyRankedHere}
${params.strengthsForInvite?.length ? `KEY STRENGTHS TO REFERENCE (invite only, paraphrase naturally): ${params.strengthsForInvite.join("; ")}` : ""}

Draft the following email(s): ${kinds.join(" AND ")}.
${wantsInvite ? `- "invite" = an interview invitation. Warm, specific about the role, proposes that Arjun's team will follow up to schedule, 2-3 short paragraphs.` : ""}
${wantsRejection ? `- "rejection" = a respectful pass. Thank them, be honest that it's not a fit right now without being harsh, keep it under 120 words, invite them to reapply in future if genuinely appropriate for this tier.` : ""}

Return JSON matching EXACTLY:
{
  "emails": [
    {"kind": "invite" | "rejection", "subject": "string", "body": "string, plain text with \\n\\n between paragraphs, ends with 'Arjun Mehta\\nFounder, Kargo'"}
  ]
}`;
}
