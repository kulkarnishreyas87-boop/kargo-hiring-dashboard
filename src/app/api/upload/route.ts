import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { exec, logAudit } from "@/lib/db";
import { extractTextFromBuffer } from "@/lib/extract";
import { scrubForAI, extractContactInfo, stripNullBytes } from "@/lib/scrub";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const appliedRoleRaw = (form.get("appliedRole") as string | null) ?? "UNSPECIFIED";
  const appliedRole = ["PM", "SPM", "UNSPECIFIED"].includes(appliedRoleRaw) ? appliedRoleRaw : "UNSPECIFIED";

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const created: { id: string; filename: string }[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const file of files) {
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const text = stripNullBytes(await extractTextFromBuffer(buf, file.name));
      if (!text || text.length < 30) {
        throw new Error("Extracted almost no text — file may be a scanned image without a text layer.");
      }

      const baseName = file.name.replace(/\.(pdf|docx)$/i, "").replace(/[^a-zA-Z0-9]+/g, "_");
      const id = `${baseName}_${randomUUID().slice(0, 8)}`;
      const name = baseName.replace(/_/g, " ").trim() || "Unnamed candidate";
      const contact = extractContactInfo(text, name);
      const scrubbed = scrubForAI(text, name);

      await exec(
        `INSERT INTO candidates (id, name, email, phone, filename, source, applied_role, resume_text, scrubbed_text, pipeline_status)
         VALUES ($1, $2, $3, $4, $5, 'applicant', $6, $7, $8, 'pending')`,
        [id, name, contact.email, contact.phone, file.name, appliedRole, text, scrubbed]
      );

      await logAudit(id, "uploaded", { filename: file.name, appliedRole });
      created.push({ id, filename: file.name });
    } catch (e) {
      errors.push({ filename: file.name, error: (e as Error).message });
    }
  }

  return NextResponse.json({ created, errors });
}
