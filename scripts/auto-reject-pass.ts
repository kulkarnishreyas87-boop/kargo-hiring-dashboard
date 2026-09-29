/**
 * One-off backfill: auto-rejects every already-scored PASS-tier candidate who is still
 * sitting at decision='pending', same policy now baked into runFinishStage for anyone
 * scored from here on. Skips anyone a human has already made a call on (advance or reject).
 * Usage: npx tsx scripts/auto-reject-pass.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { all as dbAll } from "../src/lib/db";
import { autoRejectPassTier } from "../src/lib/pipeline";

async function main() {
  const rows = await dbAll<{ id: string; name: string; rejection_email_id: string | null }>(
    `SELECT c.id, c.name, (
        SELECT e.id FROM emails e WHERE e.candidate_id = c.id AND e.kind = 'rejection' ORDER BY e.created_at DESC LIMIT 1
      ) as rejection_email_id
     FROM candidates c
     JOIN scores s ON s.candidate_id = c.id
     JOIN decisions d ON d.candidate_id = c.id
     WHERE c.source = 'applicant' AND s.final_tier = 'PASS' AND d.decision = 'pending'
     ORDER BY c.id`
  );

  console.log(`Found ${rows.length} pending PASS-tier candidates to auto-reject.`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.rejection_email_id) {
      console.log(`SKIP  ${row.id} (${row.name}) — no rejection draft on file`);
      skipped++;
      continue;
    }
    try {
      await autoRejectPassTier(row.id, row.rejection_email_id);
      console.log(`OK    ${row.id} (${row.name})`);
      sent++;
    } catch (e) {
      console.log(`ERROR ${row.id} (${row.name}): ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${sent} processed, ${failed} errored, ${skipped} skipped (no draft).`);
  console.log(`Note: "processed" means the decision was set and a send was attempted — check`);
  console.log(`the dashboard for which sends actually delivered vs hit the Resend sandbox limit.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
