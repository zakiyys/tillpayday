import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { money } from "@/lib/format";

// Small server-safe UI primitives. Styling follows DESIGN.md tokens.

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-card-sm border border-line bg-surface p-4", className)} {...rest}>
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] font-[650] tracking-[-0.01em] text-ink md:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

const btnBase =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-4 text-sm font-[600] whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none";
export const btn = {
  primary: cx(btnBase, "bg-accent text-on-accent hover:opacity-90"),
  secondary: cx(btnBase, "border border-line-strong/50 bg-surface text-ink hover:bg-surface-2"),
  ghost: cx(btnBase, "text-ink hover:bg-surface-2"),
  danger: cx(btnBase, "border border-warning/60 bg-surface text-warning hover:bg-warning-soft"),
};

export function ButtonLink({ href, variant = "secondary", children, className }: { href: string; variant?: keyof typeof btn; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx(btn[variant], className)}>
      {children}
    </Link>
  );
}

/** A signed amount. Sign is always printed for income/expense; colour is secondary (SPEC 12.2). */
export function Amount({
  value,
  currency,
  intl,
  tone = "auto",
  sign = false,
  className,
  exp,
}: {
  value: bigint | string;
  currency: string;
  intl: string;
  tone?: "auto" | "plain" | "income" | "expense";
  sign?: boolean;
  className?: string;
  exp?: number;
}) {
  const v = typeof value === "bigint" ? value : BigInt(value);
  const t = tone === "auto" ? (sign ? (v > 0n ? "income" : v < 0n ? "expense" : "plain") : "plain") : tone;
  return (
    <span className={cx("num font-[600]", t === "income" && "text-accent", t === "expense" && "text-ink", className)}>
      {money(v, currency, intl, { sign, exp })}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card-sm border border-dashed border-line-strong/40 px-5 py-8 text-center">
      <p className="font-[600] text-ink">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Chip({ children, active = true, className }: { children: ReactNode; active?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center rounded-chip px-2.5 text-xs font-[600]",
        active ? "bg-accent-soft text-on-accent-soft" : "border border-line text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Progress({ ratio, label, onHero = false, warn = false }: { ratio: number; label: string; onHero?: boolean; warn?: boolean }) {
  const pctv = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pctv)}
      className={cx("h-2 w-full overflow-hidden rounded-full", onHero ? "bg-on-hero/25" : "bg-line")}
    >
      <div className={cx("h-full rounded-full", onHero ? "bg-on-hero" : warn ? "bg-warning" : "bg-accent")} style={{ width: `${pctv}%` }} />
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      className={cx(
        "rounded-btn border px-3 py-2.5 text-sm",
        tone === "warn" ? "border-warning/50 bg-warning-soft text-warning" : "border-line bg-surface-2 text-ink",
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2">
      <h2 className="text-base font-[650] text-ink">{children}</h2>
      {action}
    </div>
  );
}
