"use client";

import { useState } from "react";
import Link from "next/link";

type EvalStatus = "queued" | "scoring" | "done" | "error";

interface EvalItem {
  id: string;
  filename: string;
  status: EvalStatus;
  error?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [role, setRole] = useState("UNSPECIFIED");
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{ filename: string; error: string }[]>([]);
  const [items, setItems] = useState<EvalItem[]>([]);

  async function submit() {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErrors([]);
    setItems([]);

    const form = new FormData();
    for (const f of Array.from(files)) form.append("files", f);
    form.append("appliedRole", role);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json: { created: { id: string; filename: string }[]; errors: { filename: string; error: string }[] } = await res.json();
    setUploadErrors(json.errors ?? []);
    setUploading(false);
    setFiles(null);

    const queued: EvalItem[] = (json.created ?? []).map((c) => ({ id: c.id, filename: c.filename, status: "queued" }));
    setItems(queued);

    // Evaluate one at a time. Each candidate's 4-step Gemini pipeline (score,
    // guardrail, brief, email draft) is split into two requests — score+guardrail,
    // then brief+emails — so neither call gets close to the serverless function
    // time limit, even though the full pipeline for one candidate can run 30-45s.
    for (const item of queued) {
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "scoring" } : p)));
      try {
        const scoreRes = await fetch(`/api/candidates/${item.id}/rerun/score`, { method: "POST" });
        if (!scoreRes.ok) {
          const j = await scoreRes.json().catch(() => ({}));
          throw new Error(j.error ?? scoreRes.statusText);
        }
        const finishRes = await fetch(`/api/candidates/${item.id}/rerun/finish`, { method: "POST" });
        if (!finishRes.ok) {
          const j = await finishRes.json().catch(() => ({}));
          throw new Error(j.error ?? finishRes.statusText);
        }
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "done" } : p)));
      } catch (e) {
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: (e as Error).message } : p)));
      }
    }
  }

  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length;
  const evaluating = items.length > 0 && doneCount < items.length;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="animate-fade-in-up flex items-start gap-4">
        <div className="float-slow shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm">
          <UploadIcon />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Upload CVs</h1>
          <p className="text-slate-500 text-sm mt-1">
            PDF or DOCX. Each candidate is scored automatically the moment it&apos;s uploaded — same 4-step pipeline
            (score, guardrail, interview brief, email drafts) used for the rest of the shortlist. If it lands as PASS,
            the rejection sends right away; INTERVIEW or REVIEW candidates wait for your Advance/Reject call.
          </p>
        </div>
      </div>

      <div className="animate-fade-in-up rounded-lg border border-slate-200 bg-white p-5 space-y-4" style={{ animationDelay: "60ms" }}>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Applied role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={uploading || evaluating}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm text-slate-900 disabled:opacity-50"
          >
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
            disabled={uploading || evaluating}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:text-white file:px-3 file:py-1.5 disabled:opacity-50"
          />
        </div>
        <button
          onClick={submit}
          disabled={!files || files.length === 0 || uploading || evaluating}
          className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm transition-all hover:bg-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <span className="spinner inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white" />
              Uploading…
            </span>
          ) : (
            "Upload & evaluate"
          )}
        </button>
      </div>

      {uploadErrors.length > 0 && (
        <div className="animate-fade-in-up rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
          <p className="font-medium text-rose-700 mb-1">{uploadErrors.length} file(s) could not be read:</p>
          <ul className="space-y-1 text-rose-600">
            {uploadErrors.map((e, i) => (
              <li key={i}>
                {e.filename}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <div className="animate-fade-in-up rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <h2 className="font-medium">
              {evaluating ? "Evaluating…" : "Evaluation complete"}{" "}
              <span className="text-slate-400 font-normal tabular-nums">
                ({doneCount}/{items.length})
              </span>
            </h2>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-500 ease-out"
              style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
            />
          </div>
          <ul className="space-y-1.5 text-sm">
            {items.map((item, i) => (
              <li
                key={item.id}
                className="animate-fade-in-up flex items-center gap-2.5"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <StatusIcon status={item.status} />
                <span className="text-slate-700 flex-1 truncate">{item.filename}</span>
                {item.status === "done" && (
                  <Link href={`/candidates/${item.id}`} className="text-blue-600 hover:underline text-xs shrink-0">
                    View →
                  </Link>
                )}
                {item.status === "error" && <span className="text-rose-600 text-xs shrink-0">{item.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 16V6M12 6l-4 4M12 6l4 4M5 18h14"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusIcon({ status }: { status: EvalStatus }) {
  if (status === "queued") return <span className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />;
  if (status === "scoring")
    return <span className="spinner w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-600 shrink-0" />;
  if (status === "done")
    return (
      <span className="animate-pop-in w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center shrink-0">
        ✓
      </span>
    );
  return (
    <span className="animate-pop-in w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center shrink-0">
      !
    </span>
  );
}
