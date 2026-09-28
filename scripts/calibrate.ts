/**
 * Rubric section 8 acceptance test — run this BEFORE scoring the 50 applicants.
 * Scores Arjun's 8 past hires against Layer A (pattern) only, and checks:
 *   - every "Exceeds Expectations" hire scores pattern_score >= 85
 *   - every "Meets"/"Below" hire scores pattern_score <= 45
 * If this fails, the scoring prompt needs fixing before it's trusted on real applicants.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { all } from "../src/lib/db";
import { generateJson } from "../src/lib/gemini";
import { SCORING_SYSTEM_PROMPT, buildScoringPrompt } from "../src/lib/rubric";
import type { ScoringResult } from "../src/lib/types";

const EXPECTED: Record<string, "Exceeds" | "Meets" | "Below"> = {
  cv_01_rohan_desai: "Exceeds",
  cv_02_sunita_krishnamurthy: "Exceeds",
  cv_07_lavanya_iyer: "Exceeds",
  cv_06_meghna_tiwari: "Exceeds",
  cv_04_aditya_shetty: "Exceeds",
  cv_05_preetham_rao: "Below",
  cv_08_rahul_bose: "Meets",
  cv_03_vikram_nair: "Meets",
};

async function main() {
  const rows = await all<{ id: string; applied_role: string; scrubbed_text: string }>(
    `SELECT id, applied_role, scrubbed_text FROM candidates WHERE source = 'hire' ORDER BY id`
  );

  if (rows.length === 0) {
    console.error("No hire CVs found in DB. Run `npx tsx scripts/ingest.ts` first.");
    process.exit(1);
  }

  let allPass = true;
  const results: { id: string; rating: string; pattern_score: number; expectedOk: boolean }[] = [];

  for (const row of rows) {
    const prompt = buildScoringPrompt({ candidateId: row.id, appliedRole: row.applied_role, scrubbedResume: row.scrubbed_text });
    const scoring = await generateJson<ScoringResult>({ system: SCORING_SYSTEM_PROMPT, prompt, temperature: 0.1 });
    const rating = EXPECTED[row.id];
    const expectedOk = rating === "Exceeds" ? scoring.pattern.pattern_score >= 85 : scoring.pattern.pattern_score <= 45;
    if (!expectedOk) allPass = false;
    results.push({ id: row.id, rating, pattern_score: scoring.pattern.pattern_score, expectedOk });
    console.log(
      `${row.id.padEnd(30)} rating=${rating.padEnd(8)} pattern_score=${scoring.pattern.pattern_score.toString().padEnd(6)} ${
        expectedOk ? "PASS" : "FAIL <-- fix the prompt"
      }`
    );
  }

  console.log("\n" + (allPass ? "✅ Calibration PASSED — safe to score the 50 applicants." : "❌ Calibration FAILED — do not trust the scorer yet. Adjust SCORING_SYSTEM_PROMPT / buildScoringPrompt in src/lib/rubric.ts and rerun."));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
