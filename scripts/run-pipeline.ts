/**
 * Bulk-runs the 4-step Gemini pipeline (score -> guardrail -> brief -> email drafts)
 * over every applicant candidate that hasn't been scored yet.
 * Usage: npx tsx scripts/run-pipeline.ts [--force] [--only=id1,id2] [--concurrency=3]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { all as dbAll } from "../src/lib/db";
import { runPipelineForCandidate } from "../src/lib/pipeline";

const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.replace("--only=", "").split(",") : null;
const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const concurrency = concurrencyArg ? parseInt(concurrencyArg.replace("--concurrency=", ""), 10) : 3;

async function pool<T>(items: T[], size: number, worker: (item: T, idx: number) => Promise<void>) {
  let cursor = 0;
  async function runNext(): Promise<void> {
    const idx = cursor++;
    if (idx >= items.length) return;
    await worker(items[idx], idx);
    return runNext();
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => runNext()));
}

async function main() {
  let rows = await dbAll<{ id: string }>(
    `SELECT id FROM candidates WHERE source = 'applicant' ${force ? "" : "AND pipeline_status NOT IN ('scored','drafted')"} ORDER BY id`
  );

  if (only) rows = rows.filter((r) => only.includes(r.id));

  console.log(`Running pipeline for ${rows.length} candidates (concurrency=${concurrency}, force=${force})`);

  let done = 0;
  let failed = 0;
  await pool(rows, concurrency, async (row) => {
    try {
      await runPipelineForCandidate(row.id);
      done++;
      console.log(`[${done + failed}/${rows.length}] OK    ${row.id}`);
    } catch (e) {
      failed++;
      console.log(`[${done + failed}/${rows.length}] ERROR ${row.id}: ${(e as Error).message}`);
    }
  });

  console.log(`\nDone. ${done} succeeded, ${failed} failed.`);
  if (failed > 0) {
    console.log(`Re-run with: npx tsx scripts/run-pipeline.ts --only=${rows.map((r) => r.id).join(",")}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
