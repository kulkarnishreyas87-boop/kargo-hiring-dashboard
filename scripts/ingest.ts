import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { one, exec, logAudit } from "../src/lib/db";
import { scrubForAI, extractContactInfo, nameFromFilename, stripNullBytes } from "../src/lib/scrub";

const extractedDir = path.join(process.cwd(), "data", "extracted");

async function main() {
  const files = fs.readdirSync(extractedDir).filter((f) => f.endsWith(".json") && f !== "_manifest.json");
  let inserted = 0;
  let skipped = 0;
  for (const f of files) {
    const record = JSON.parse(fs.readFileSync(path.join(extractedDir, f), "utf-8")) as {
      id: string;
      group: "hire" | "applicant";
      filename: string;
      appliedRole: string;
      text: string;
    };

    const existing = await one(`SELECT id FROM candidates WHERE id = $1`, [record.id]);
    if (existing) {
      skipped++;
      continue;
    }

    const name = nameFromFilename(record.id);
    const cleanText = stripNullBytes(record.text);
    const contact = extractContactInfo(cleanText, name);
    const scrubbed = scrubForAI(cleanText, name);

    await exec(
      `INSERT INTO candidates (id, name, email, phone, filename, source, applied_role, resume_text, scrubbed_text, pipeline_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
      [record.id, name, contact.email, contact.phone, record.filename, record.group, record.appliedRole, cleanText, scrubbed]
    );
    await logAudit(record.id, "ingested", { source: record.group, appliedRole: record.appliedRole });
    inserted++;
  }
  console.log(`Ingested ${inserted} new candidates, skipped ${skipped} already present.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
