"use client";

import { useEffect, useState } from "react";

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Animated donut chart, hand-rolled SVG (no charting dependency). Fills in on mount. */
export function DonutChart({ data, size = 150, thickness = 20 }: { data: Segment[]; size?: number; thickness?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = d.value / total;
            const dash = mounted ? frac * circumference : 0;
            const gap = circumference - dash;
            const strokeDashoffset = -acc;
            acc += mounted ? dash : 0;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={strokeDashoffset}
                style={{ transition: `stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s` }}
              />
            );
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 font-semibold" style={{ fontSize: size * 0.22 }}>
          {total}
        </text>
        <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400" style={{ fontSize: size * 0.08 }}>
          total
        </text>
      </svg>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm group cursor-default">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-slate-600">{d.label}</span>
            <span className="font-medium text-slate-900 tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Animated horizontal bar chart. */
export function BarChart({ data }: { data: Segment[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="group">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{d.label}</span>
            <span className="font-medium text-slate-700 tabular-nums">{d.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
              style={{ width: mounted ? `${(d.value / max) * 100}%` : "0%", backgroundColor: d.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
