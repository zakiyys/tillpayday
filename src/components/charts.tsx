"use client";

import { useId, useState } from "react";

const compact = (intl: string) => (v: number) => new Intl.NumberFormat(intl, { notation: "compact", maximumFractionDigits: 1 }).format(v);

/**
 * Small SVG charts following the data-vis rules in SPEC 12.4: readable axes and labels, not colour-only
 * (income bars are solid, expense bars are outlined with a pattern edge and labelled), values on hover and focus,
 * and every chart has a table equivalent for screen readers.
 */
export function BarPairs({
  data,
  labels,
  intl,
  title,
  desc,
}: {
  data: Array<{ label: string; a: number; b: number; aText: string; bText: string }>;
  labels: { a: string; b: string };
  intl: string;
  title: string;
  desc: string;
}) {
  const id = useId();
  const fmtAxis = compact(intl);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const W = 560;
  const H = 260;
  const pad = { l: 64, r: 12, t: 12, b: 36 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / Math.max(1, data.length);
  const bw = Math.min(28, step / 3);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
        <title id={`${id}-t`}>{title}</title>
        <desc id={`${id}-d`}>{desc}</desc>
        {ticks.map((v, i) => {
          const y = pad.t + ih - (v / max) * ih;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize={13} fill="var(--ink-muted)" className="num">
                {fmtAxis(v)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = pad.l + i * step + step / 2;
          const ha = (d.a / max) * ih;
          const hb = (d.b / max) * ih;
          return (
            <g key={d.label} tabIndex={0} role="img" aria-label={`${d.label}: ${labels.a} ${d.aText}, ${labels.b} ${d.bText}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none">
              <rect x={x - bw - 2} y={pad.t + ih - ha} width={bw} height={Math.max(0, ha)} rx={3} fill="var(--accent)" />
              <rect x={x + 2} y={pad.t + ih - hb} width={bw} height={Math.max(0, hb)} rx={3} fill="var(--expense-bar)" stroke="var(--expense-edge)" strokeWidth={1} />
              <text x={x} y={H - 14} textAnchor="middle" fontSize={13} fill="var(--ink-muted)">
                {d.label}
              </text>
              {hover === i ? (
                <g>
                  <rect x={Math.min(W - 170, Math.max(pad.l, x - 80))} y={pad.t} width={160} height={40} rx={8} fill="var(--surface)" stroke="var(--line-strong)" />
                  <text x={Math.min(W - 170, Math.max(pad.l, x - 80)) + 8} y={pad.t + 16} fontSize={13} fill="var(--ink)" className="num">
                    {labels.a}: {d.aText}
                  </text>
                  <text x={Math.min(W - 170, Math.max(pad.l, x - 80)) + 8} y={pad.t + 32} fontSize={13} fill="var(--ink)" className="num">
                    {labels.b}: {d.bText}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-[3px] bg-accent" />
          {labels.a}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-3 rounded-[3px] border border-expense-edge bg-expense" />
          {labels.b}
        </span>
      </figcaption>
    </figure>
  );
}

export function Line({ points, title, desc, intl, zeroLine = false, emptyText }: { points: Array<{ label: string; v: number; text: string }>; title: string; desc: string; intl: string; zeroLine?: boolean; emptyText?: string }) {
  const id = useId();
  const fmtAxis = compact(intl);
  // A trend needs two points; with one, say so instead of drawing an empty frame.
  if (points.length < 2) return <p className="rounded-btn bg-surface-2 p-3 text-sm text-muted">{emptyText ?? points[0]?.text ?? ""}</p>;
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 220;
  const pad = { l: 64, r: 12, t: 12, b: 28 };
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals, zeroLine ? 0 : Infinity);
  const hi = Math.max(...vals, zeroLine ? 0 : -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const every = Math.ceil(points.length / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
      <title id={`${id}-t`}>{title}</title>
      <desc id={`${id}-d`}>{desc}</desc>
      {[lo, (lo + hi) / 2, hi].map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={13} fill="var(--ink-muted)" className="num">
            {fmtAxis(v)}
          </text>
        </g>
      ))}
      {zeroLine && lo < 0 ? <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--warning)" strokeDasharray="4 4" /> : null}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i} tabIndex={0} role="img" aria-label={`${p.label}: ${p.text}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none">
          <circle cx={x(i)} cy={y(p.v)} r={hover === i ? 5 : 3} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
          <rect x={x(i) - 8} y={pad.t} width={16} height={H - pad.t - pad.b} fill="transparent" />
          {i % every === 0 || i === points.length - 1 ? (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={13} fill="var(--ink-muted)">
              {p.label}
            </text>
          ) : null}
          {hover === i ? (
            <text x={Math.min(W - 80, Math.max(pad.l + 40, x(i)))} y={pad.t + 12} textAnchor="middle" fontSize={14} fill="var(--ink)" className="num">
              {p.label}: {p.text}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
