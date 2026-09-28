import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "data", "extracted");
fs.mkdirSync(outDir, { recursive: true });

async function extractOne(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value;
  } else if (ext === ".pdf") {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }
  throw new Error("Unsupported file type: " + filePath);
}

function inferAppliedRole(filename, text) {
  const lower = filename.toLowerCase();
  if (lower.startsWith("pm_")) return "PM";
  if (lower.startsWith("spm_")) return "SPM";
  // scan text for explicit statement
  const t = text.toLowerCase();
  const spmHit = /applying for[^\n]*senior product manager|role applied[^\n]*senior product manager|position[^\n]*senior product manager/.exec(t);
  if (spmHit) return "SPM";
  const pmHit = /applying for[^\n]*product manager|role applied[^\n]*product manager|position[^\n]*product manager/.exec(t);
  if (pmHit) return "PM";
  return "UNSPECIFIED";
}

async function main() {
  const dirs = [
    { dir: path.join(root, "data", "resumes", "hires"), group: "hire" },
    { dir: path.join(root, "data", "resumes", "applicants"), group: "applicant" },
  ];
  const manifest = [];
  for (const { dir, group } of dirs) {
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    for (const f of files) {
      const full = path.join(dir, f);
      const text = await extractOne(full);
      const id = path.basename(f, path.extname(f));
      const appliedRole = group === "hire" ? "N/A" : inferAppliedRole(f, text);
      const record = { id, group, filename: f, appliedRole, text: text.trim() };
      fs.writeFileSync(path.join(outDir, id + ".json"), JSON.stringify(record, null, 2));
      manifest.push({ id, group, filename: f, appliedRole, chars: text.trim().length });
      console.log(group.padEnd(10), appliedRole.padEnd(12), f, "->", text.trim().length, "chars");
    }
  }
  fs.writeFileSync(path.join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("Done. Extracted", manifest.length, "files.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
