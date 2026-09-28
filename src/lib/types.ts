export type Confidence = "high" | "medium" | "low";

export interface CriterionScore {
  score: number; // 0-4
  evidence: string;
  confidence: Confidence;
}

export interface PatternScores {
  P1: CriterionScore;
  P2: CriterionScore;
  P3: CriterionScore;
  P4: CriterionScore;
  pattern_score: number;
}

export interface PmRoleScores {
  criteria: {
    PM1: CriterionScore;
    PM2: CriterionScore;
    PM3: CriterionScore;
    PM4: CriterionScore;
  };
  role_score: number;
  composite: number;
  tier: "INTERVIEW" | "REVIEW" | "PASS";
}

export interface SpmRoleScores {
  criteria: {
    SPM1: CriterionScore;
    SPM2: CriterionScore;
    SPM3: CriterionScore;
    SPM4: CriterionScore;
    SPM5: CriterionScore;
  };
  role_score: number;
  composite: number;
  tier: "INTERVIEW" | "REVIEW" | "PASS";
}

export interface ScoringResult {
  candidate_id: string;
  applied_role: "PM" | "SPM" | "UNSPECIFIED";
  pattern: PatternScores;
  role_pm: PmRoleScores;
  role_spm: SpmRoleScores;
  recommended_role: "PM" | "SPM";
  reroute_suggested: boolean;
  experience_band_pm: "in" | "below" | "above";
  experience_band_spm: "in" | "below" | "above";
  why_ranked_here: string;
  probes: string[];
}

export interface GuardrailResult {
  potential_flag: boolean;
  potential_reason: string;
  final_tier: "INTERVIEW" | "REVIEW" | "PASS";
  tier_changed: boolean;
  guardrail_notes: string;
}

export interface InterviewBrief {
  summary: string;
  strengths: string[];
  risks_and_gaps: string[];
  probe_questions: string[];
  suggested_focus_areas: string[];
}

export interface EmailDraft {
  kind: "invite" | "rejection";
  subject: string;
  body: string;
}

export interface EmailDraftBundle {
  emails: EmailDraft[];
}
