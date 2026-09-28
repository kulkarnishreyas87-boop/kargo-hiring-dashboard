"use client";

import { useState } from "react";
import Link from "next/link";

export default function UploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [role, setRole] = useState("UNSPECIFIED");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: { id: string; filename: string }[]; errors: { filename: string; error: string }[] } | null>(null);

  async function submit() {
    if (!files || files.length === 0) return;
    setBusy(true);
    setResult(null);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    form.append("appliedRole", role);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = await res.json();
    setResult(json);
    setBusy(false);
    setFiles(null);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload CVs</h1>
        <p className="text-slate-500 text-sm mt-1">
          PDF or DOCX. Uploaded candidates land in the shortlist as &ldquo;pending&rdquo; — score them with{" "}
          <code className="bg-slate-100 px-1 rounded">npx tsx scripts/run-pipeline.ts</code>, or re-run individually from their
          candidate page.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Applied role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm">
            <option value="UNSPECIFIED">Not specified — score against both</option>
            <option value="PM">Product Manager</option>
            <option value="SPM">Senior Product Manager</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Files</label>
          <input
            type="file"
            multiple
            accept=".pdf,.docx"
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:text-white file:px-3 file:py-1.5"
          />
        </div>
        <button
          onClick={submit}
          disabled={!files || files.length === 0 || busy}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-40"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 text-sm">
          {result.created.length > 0 && (
            <div>
              <p className="font-medium text-emerald-700 mb-1">{result.created.length} candidate(s) added:</p>
              <ul className="space-y-1">
                {result.created.map((c) => (
                  <li key={c.id}>
                    {c.filename} →{" "}
                    <Link href={`/candidates/${c.id}`} className="text-blue-600 hover:underline">
                      view
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div>
              <p className="font-medium text-rose-700 mb-1">{result.errors.length} failed:</p>
              <ul className="space-y-1 text-rose-600">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.filename}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
