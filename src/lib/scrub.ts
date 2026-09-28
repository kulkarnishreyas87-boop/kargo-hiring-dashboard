/**
 * Strips the personal-identifier fields the rubric (section 6) says must never
 * reach the scoring model: email, phone, and name-as-header lines. College tier,
 * certifications, and employer prestige can't be safely regex-stripped without
 * destroying the operational evidence the rubric needs (e.g. "CHA" employer names
 * are themselves P1 evidence) — those are instead neutralised via an explicit
 * system-prompt instruction to the model (see rubric.ts SCORING_SYSTEM_PROMPT).
 */
/** Postgres text columns reject raw NUL bytes, which pdf-parse occasionally emits. */
export function stripNullBytes(text: string): string {
  return text.replace(/\u0000/g, "");
}

export function scrubForAI(rawText: string, candidateName: string): string {
  let text = stripNullBytes(rawText);

  // Emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email removed]");

  // Phone numbers (Indian + generic international patterns)
  text = text.replace(/(\+?\d{1,3}[\s-]?)?\d{10}\b/g, "[phone removed]");
  text = text.replace(/\+?\d[\d\s-]{7,}\d/g, "[phone removed]");

  // LinkedIn / personal handles
  text = text.replace(/linkedin\.com\/\S+/gi, "[link removed]");

  // Candidate name, in a few common casings/spacings
  if (candidateName && candidateName.length > 2) {
    const escaped = candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escaped, "gi"), "[Candidate]");
    const parts = candidateName.split(" ").filter(Boolean);
    for (const p of parts) {
      if (p.length > 2) {
        text = text.replace(new RegExp(`\\b${p}\\b`, "g"), "[Candidate]");
      }
    }
  }

  return text;
}

/** Best-effort extraction of name/email/phone from raw resume text, used only
 * for the human-facing UI and to send email later — never passed to the AI. */
export function extractContactInfo(rawText: string, fallbackNameFromFilename: string) {
  const emailMatch = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.exec(rawText);
  const phoneMatch = /(\+?\d{1,3}[\s-]?)?\d{10}\b/.exec(rawText);
  return {
    name: fallbackNameFromFilename,
    email: emailMatch ? emailMatch[0] : null,
    phone: phoneMatch ? phoneMatch[0] : null,
  };
}

export function nameFromFilename(id: string): string {
  // e.g. "01_rohan_mehta" -> "Rohan Mehta", "pm_07_aditi_sharma" -> "Aditi Sharma", "cv_01_rohan_desai" -> "Rohan Desai"
  const parts = id.split("_").filter((p) => !/^\d+$/.test(p) && p !== "cv" && p !== "pm" && p !== "spm");
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
