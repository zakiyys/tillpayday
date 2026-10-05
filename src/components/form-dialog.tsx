"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Dialog } from "./dialog";
import { useErrorText } from "./form";
import { btn, Notice } from "./ui";

/**
 * Button + dialog + form that posts to an API route. `build` turns the form into the request body.
 * Keeps the many small Stage 6 forms (debt, split, trade, price, trip) to their fields only.
 */
export function FormDialog({
  label,
  title,
  endpoint,
  method = "POST",
  build,
  children,
  submitLabel,
  variant = "secondary",
  ns,
  disabled,
  ariaLabel,
  sync = false,
}: {
  label: ReactNode;
  title: string;
  endpoint: string;
  method?: "POST" | "PATCH";
  build: (f: FormData) => unknown;
  children: ReactNode;
  submitLabel: string;
  variant?: keyof typeof btn;
  ns?: string;
  disabled?: boolean;
  ariaLabel?: string;
  sync?: boolean;
}) {
  const router = useRouter();
  const errText = useErrorText(ns);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className={btn[variant]} onClick={() => setOpen(true)} disabled={disabled} aria-label={ariaLabel}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(endpoint, { method, body: build(new FormData(e.currentTarget)) });
              if (sync) await api("/api/v1/periods/sync", { body: {} });
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {error ? <Notice tone="warn">{error}</Notice> : null}
          {children}
          <button type="submit" className={btn.primary + " w-full"} disabled={busy}>
            {submitLabel}
          </button>
        </form>
      </Dialog>
    </>
  );
}

/** Plain action button that calls an API route and refreshes. */
export function ActionButton({ label, endpoint, method = "POST", body = {}, variant = "ghost", ariaLabel }: { label: ReactNode; endpoint: string; method?: "POST" | "PATCH" | "DELETE"; body?: unknown; variant?: keyof typeof btn; ariaLabel?: string }) {
  const router = useRouter();
  const errText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={btn[variant]}
        aria-label={ariaLabel}
        onClick={async () => {
          setError(null);
          try {
            await api(endpoint, { method, body });
            router.refresh();
          } catch (e) {
            setError(errText(e));
          }
        }}
      >
        {label}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-warning">
          {error}
        </span>
      ) : null}
    </>
  );
}
