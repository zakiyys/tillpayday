"use client";

import { useTranslations } from "next-intl";
import { useId, type ComponentProps, type ReactNode } from "react";
import { ApiError } from "@/lib/api-client";

/** Label above input, help below, error below that (taste-skill 4.6). */
export function Field({
  label,
  help,
  error,
  children,
  id,
}: {
  label: string;
  help?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-[550] text-ink">
        {label}
      </label>
      {children}
      {help ? (
        <p id={`${id}-help`} className="text-xs text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="text-xs font-[550] text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputCls =
  "min-h-11 w-full rounded-btn border border-line-strong/50 bg-surface px-3 text-base text-ink placeholder:text-muted/80 focus-visible:border-accent";

export function TextInput({ label, help, error, ...rest }: Omit<ComponentProps<"input">, "id"> & { label: string; help?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field id={id} label={label} help={help} error={error}>
      <input
        id={id}
        className={inputCls}
        aria-invalid={error ? true : undefined}
        aria-describedby={[help ? `${id}-help` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
    </Field>
  );
}

export function Select({
  label,
  help,
  error,
  children,
  ...rest
}: Omit<ComponentProps<"select">, "id"> & { label: string; help?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field id={id} label={label} help={help} error={error}>
      <select id={id} className={inputCls} aria-describedby={help ? `${id}-help` : undefined} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({ label, help, ...rest }: Omit<ComponentProps<"input">, "id" | "type"> & { label: string; help?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-1 size-5 accent-[var(--accent)]" {...rest} />
      <label htmlFor={id} className="text-sm text-ink">
        {label}
        {help ? <span className="block text-xs text-muted">{help}</span> : null}
      </label>
    </div>
  );
}

/** Maps an API error code to a translated message, trying the given namespaces first. */
export function useErrorText(ns?: string) {
  const tc = useTranslations("common.error");
  const tn = useTranslations();
  return (e: unknown): string => {
    if (e instanceof ApiError) {
      const k = ns ? `${ns}.${e.code}` : null;
      if (k && tn.has(k)) return tn(k);
      if (tc.has(e.code)) return tc(e.code);
      return tc("internal");
    }
    if (e instanceof TypeError) return tc("network");
    return tc("internal");
  };
}
