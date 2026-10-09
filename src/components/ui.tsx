import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { money } from "@/lib/format";

// Small server-safe UI primitives. Styling follows DESIGN.md tokens.

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children, flush = false, ...rest }: ComponentProps<"section"> & { flush?: boolean }) {
  return (
    <section className={cx("min-w-0 rounded-card-sm border border-line bg-surface", flush ? "overflow-hidden" : "p-4 md:p-5", className)} {...rest}>
      {children}
    </section>
  );
}

/**
 * Page title with one line on what the page is for, the primary actions, and an optional way back for pages that
 * sit under another (settings sections, account details).
 */
export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back ? (
        <Link href={back.href} className="-ml-1 mb-1 inline-flex min-h-11 items-center gap-1 rounded-btn pr-2 text-sm font-[600] text-muted hover:text-ink">
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-[1.5rem] font-[700] leading-tight tracking-[-0.02em] text-ink md:text-[1.75rem]">{title}</h1>
          {subtitle ? <p className="mt-1 text-[0.9375rem] text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

const btnBase =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-btn px-4 text-sm font-[650] whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none";
export const btn = {
  primary: cx(btnBase, "bg-accent text-on-accent shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_6px_14px_-8px_var(--accent)] hover:brightness-110"),
  secondary: cx(btnBase, "border border-line-strong/45 bg-surface text-ink hover:border-line-strong hover:bg-surface-2"),
  ghost: cx(btnBase, "text-ink hover:bg-ink/5"),
  danger: cx(btnBase, "border border-warning/55 bg-surface text-warning hover:bg-warning-soft"),
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

/** Says why a list is empty and offers the one action that fills it. */
export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-card-sm border border-dashed border-line-strong/45 bg-surface/60 px-5 py-9 text-center">
      {icon ? <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-accent-soft text-on-accent-soft">{icon}</div> : null}
      <p className="font-[650] text-ink">{title}</p>
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

/** A bar for "how much of this is used". Tone follows state: on track (glaze), close (ochre), over (terracotta). */
export function Progress({ ratio, label, onHero = false, warn = false, tone }: { ratio: number; label: string; onHero?: boolean; warn?: boolean; tone?: "ok" | "near" | "over" }) {
  const pctv = Math.max(0, Math.min(1, ratio)) * 100;
  const tn = tone ?? (warn ? "over" : "ok");
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pctv)}
      className={cx("h-2 w-full overflow-hidden rounded-full", onHero ? "bg-on-hero/25" : "bg-line")}
    >
      <div className={cx("h-full rounded-full", onHero ? "bg-on-hero" : tn === "over" ? "bg-clay" : tn === "near" ? "bg-ochre" : "bg-accent")} style={{ width: `${pctv}%` }} />
    </div>
  );
}

/** Small state label with its own tone, so state never rides on colour alone (the word carries it). */
export function StatusPill({ tone, children }: { tone: "ok" | "near" | "over" | "neutral"; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-[700]",
        tone === "ok" && "bg-accent-soft text-on-accent-soft",
        tone === "near" && "bg-ochre-soft text-ochre-ink",
        tone === "over" && "bg-clay-soft text-clay-ink",
        tone === "neutral" && "bg-surface-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** Inline message with an optional icon and one follow-up action on the right. */
export function Notice({ tone = "info", children, action, icon }: { tone?: "info" | "warn"; children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div
      role={tone === "warn" ? "alert" : "status"}
      className={cx(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn border px-3.5 py-2.5 text-sm",
        tone === "warn" ? "border-warning/45 bg-warning-soft text-warning" : "border-line bg-surface text-ink",
      )}
    >
      {icon ? <span className="shrink-0 text-muted">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {action ? <div className="flex min-h-11 shrink-0 items-center">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-8 flex min-h-11 items-center justify-between gap-2">
      <h2 className="text-[1.0625rem] font-[700] tracking-[-0.01em] text-ink">{children}</h2>
      {action}
    </div>
  );
}
