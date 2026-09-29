/**
 * Re-drafts invite/rejection emails for already-scored candidates using the current
 * EMAIL_SYSTEM_PROMPT, without re-running scoring or the interview brief. Use this after
 * changing the email prompt (tone, formatting rules, etc). Already-sent emails are left
 * untouched — only drafts still sitting at 'drafted' get replaced.
 * Usage: npx tsx scripts/redraft-emails.ts [--only=id1,id2] [--concurrency=3]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { all as dbAll } from "../src/lib/db";
import { regenerateDraftedEmails } from "../src/lib/pipeline";

const args = process.argv.slice(2);
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
    `SELECT DISTINCT c.id FROM candidates c JOIN scores s ON s.candidate_id = c.id WHERE c.source = 'applicant' ORDER BY c.id`
  );
  if (only) rows = rows.filter((r) => only.includes(r.id));

  console.log(`Re-drafting emails for ${rows.length} candidates (concurrency=${concurrency})`);

  let done = 0;
  let failed = 0;
  await pool(rows, concurrency, async (row) => {
    try {
      await regenerateDraftedEmails(row.id);
      done++;
      console.log(`[${done + failed}/${rows.length}] OK    ${row.id}`);
    } catch (e) {
      failed++;
      console.log(`[${done + failed}/${rows.length}] ERROR ${row.id}: ${(e as Error).message}`);
    }
  });

  console.log(`\nDone. ${done} succeeded, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
