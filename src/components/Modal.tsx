"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  tone = "neutral",
  children,
  actionLabel = "OK",
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  tone?: "success" | "error" | "neutral";
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toneStyles =
    tone === "success"
      ? { icon: "✓", badge: "bg-emerald-100 text-emerald-700" }
      : tone === "error"
      ? { icon: "!", badge: "bg-rose-100 text-rose-700" }
      : { icon: "i", badge: "bg-slate-100 text-slate-700" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 animate-fade-in px-4"
      onClick={onClose}
    >
      <div
        className="animate-pop-in w-full max-w-sm rounded-xl bg-white shadow-xl border border-slate-200 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold ${toneStyles.badge}`}>
            {toneStyles.icon}
          </span>
          <div className="flex-1">
            <h3 className="font-medium text-slate-900">{title}</h3>
            {children && <div className="text-sm text-slate-600 mt-1">{children}</div>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => (onAction ? onAction() : onClose())}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm transition-colors hover:bg-slate-700"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
