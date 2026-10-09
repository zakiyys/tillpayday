"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { money, shortDate } from "@/lib/format";
import { cx } from "./ui";

export interface Cup {
  date: string;
  share: string;
  spent: string;
  when: "past" | "today" | "future";
}

// A small thrown vessel: flared rim, rounded belly, narrow foot. 12 x 18 units.
const VESSEL = "M1 2.2 Q1 1 2.2 1 H9.8 Q11 1 11 2.2 L10.4 12.6 Q10 16.8 6 17 Q2 16.8 1.6 12.6 Z";

/**
 * The day-cup strip: one vessel per day of the pay period. Past days hold what was left of their share (an empty
 * cup with a terracotta rim means the day went over), today's cup is ringed in ochre, and the days after today show
 * their even share as an outline. Arrow keys or a tap pick a day; its share and spending show underneath.
 */
export function DayCups({ cups, currency, intl, exp }: { cups: Cup[]; currency: string; intl: string; exp?: number }) {
  const t = useTranslations("home.cups");
  const todayIdx = Math.max(0, cups.findIndex((c) => c.when === "today"));
  const [sel, setSel] = useState(todayIdx);
  const c = cups[sel];
  if (!c) return null;
  const fmt = (v: string) => money(v, currency, intl, { exp });
  const over = cups.filter((x) => x.when === "past" && BigInt(x.spent) > BigInt(x.share)).length;
  const move = (i: number) => {
    const n = Math.max(0, Math.min(cups.length - 1, i));
    setSel(n);
    document.getElementById(`cup-${n}`)?.focus();
  };
  const left = BigInt(c.share) - BigInt(c.spent);
  return (
    <div>
      <div
        role="group"
        aria-label={t("label", { day: todayIdx + 1, days: cups.length, over })}
        className="flex items-end gap-[3px]"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(sel + 1);
          else if (e.key === "ArrowLeft") move(sel - 1);
          else if (e.key === "Home") move(0);
          else if (e.key === "End") move(cups.length - 1);
          else return;
          e.preventDefault();
        }}
      >
        {cups.map((x, i) => {
          const share = BigInt(x.share);
          const spent = BigInt(x.spent);
          const ratio = x.when === "future" ? 1 : share > 0n ? Math.max(0, Math.min(1, Number(((share - spent) * 1000n) / share) / 1000)) : 0;
          const wentOver = x.when !== "future" && spent > share;
          return (
            <button
              key={x.date}
              id={`cup-${i}`}
              type="button"
              tabIndex={i === sel ? 0 : -1}
              aria-pressed={i === sel}
              aria-label={`${shortDate(x.date, intl)}: ${t(x.when === "future" ? "planned" : "used", { share: fmt(x.share), spent: fmt(x.spent) })}`}
              onClick={() => setSel(i)}
              className={cx("group relative min-w-0 max-w-5 flex-1 rounded-[3px] pb-1 outline-offset-1 lg:max-w-7", i === sel && "after:absolute after:inset-x-[20%] after:bottom-0 after:h-[2px] after:rounded-full after:bg-on-hero")}
            >
              <svg viewBox="0 0 12 18" className="block h-auto w-full overflow-visible" aria-hidden>
                <defs>
                  <clipPath id={`v-${i}`}>
                    <path d={VESSEL} />
                  </clipPath>
                </defs>
                <path d={VESSEL} fill="currentColor" className="text-on-hero/12" />
                <rect
                  x="0"
                  width="12"
                  y={18 - 17 * ratio}
                  height={17 * ratio}
                  clipPath={`url(#v-${i})`}
                  className={cx("cup-fill", x.when === "today" ? "fill-ochre" : x.when === "future" ? "fill-on-hero/22" : "fill-on-hero")}
                  style={{ animationDelay: `${Math.min(i, 30) * 18}ms` }}
                />
                <path
                  d={VESSEL}
                  fill="none"
                  strokeWidth={x.when === "today" ? 1.6 : 1}
                  strokeDasharray={x.when === "future" ? "1.6 1.4" : undefined}
                  className={x.when === "today" ? "stroke-ochre" : wentOver ? "stroke-clay" : "stroke-on-hero/45"}
                />
                {wentOver ? <path d="M1 2.2 Q1 1 2.2 1 H9.8 Q11 1 11 2.2" fill="none" strokeWidth={2.2} className="stroke-clay" /> : null}
              </svg>
            </button>
          );
        })}
      </div>
      <p className="num mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm text-on-hero-muted" aria-live="polite">
        <span className="font-[600] text-on-hero">{c.when === "today" ? t("today") : shortDate(c.date, intl)}</span>
        <span>
          {c.when === "future"
            ? t("plannedLine", { share: fmt(c.share) })
            : left >= 0n
              ? t("leftLine", { share: fmt(c.share), left: fmt(left.toString()) })
              : t("overLine", { share: fmt(c.share), over: fmt((-left).toString()) })}
        </span>
      </p>
    </div>
  );
}
