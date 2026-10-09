"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Delete } from "lucide-react";
import { cx } from "@/components/ui";

export const PIN_LENGTH = 6;

/**
 * Six-digit PIN entry: dots that fill in, a large keypad for touch, and the keyboard for desktop. Calls
 * `onComplete` once the sixth digit is in. The value lives in the parent so it can clear it after a wrong PIN.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  label,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  label: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const t = useTranslations("pin");
  const box = useRef<HTMLDivElement>(null);
  const push = (d: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    const next = value + d;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };
  const pop = () => !disabled && onChange(value.slice(0, -1));
  useEffect(() => box.current?.focus(), []);
  return (
    <div
      ref={box}
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={error ? "pin-err" : undefined}
      className="rounded-card outline-none"
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) push(e.key);
        else if (e.key === "Backspace") pop();
        else return;
        e.preventDefault();
      }}
    >
      <p className="text-center text-sm font-[550] text-ink">{label}</p>
      <div className={cx("mx-auto mt-4 flex w-fit gap-3", error && "animate-[shake_.3s_ease-in-out]")} aria-live="polite" aria-label={t("entered", { n: value.length, total: PIN_LENGTH })}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} aria-hidden className={cx("size-3.5 rounded-full border-2 transition-colors", i < value.length ? "border-accent bg-accent" : "border-line-strong/60 bg-transparent", error && "border-warning")} />
        ))}
      </div>
      <p id="pin-err" role={error ? "alert" : undefined} className="mt-3 min-h-5 text-center text-sm font-[550] text-warning">
        {error ?? ""}
      </p>
      <div className="mx-auto mt-2 grid max-w-[18rem] grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => push(d)} disabled={disabled}>
            {d}
          </Key>
        ))}
        <span />
        <Key onClick={() => push("0")} disabled={disabled}>
          0
        </Key>
        <Key onClick={pop} disabled={disabled || !value} label={t("backspace")} subtle>
          <Delete size={22} strokeWidth={1.75} aria-hidden />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled, label, subtle }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string; subtle?: boolean }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "press num grid h-14 place-items-center rounded-full text-2xl font-[600] text-ink disabled:opacity-40",
        subtle ? "bg-transparent hover:bg-surface-2" : "bg-surface-2 hover:bg-line/60",
      )}
    >
      {children}
    </button>
  );
}
