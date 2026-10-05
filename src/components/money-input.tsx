"use client";

import { useId, useState } from "react";
import { Field, inputCls } from "./form";
import { majorStrToMinor, minorToInput, parseMajor } from "@/lib/format";

/**
 * Money input in major units, typed in the user's style ("1.500.000", "12,50").
 * Reports the value as a minor-unit string, or null while the text is not a valid amount.
 */
export function MoneyInput({
  label,
  help,
  error,
  exp,
  currency,
  name,
  defaultMinor,
  onMinor,
  required,
  allowNegative = false,
}: {
  label: string;
  help?: string;
  error?: string | null;
  exp: number;
  currency: string;
  name: string;
  defaultMinor?: string | null;
  onMinor?: (v: string | null) => void;
  required?: boolean;
  allowNegative?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(defaultMinor != null && defaultMinor !== "" ? minorToInput(defaultMinor, exp) : "");
  const parsed = parseMajor(text);
  const minor = parsed == null ? null : majorStrToMinor(parsed, exp);
  const invalid = text !== "" && (minor == null || (!allowNegative && minor < 0n));
  return (
    <Field id={id} label={label} help={help} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-[600] text-muted">{currency}</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={inputCls + " num pl-14"}
          value={text}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={help ? `${id}-help` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const p = parseMajor(e.target.value);
            const m = p == null ? null : majorStrToMinor(p, exp);
            onMinor?.(m == null ? null : m.toString());
          }}
        />
        <input type="hidden" name={name} value={minor == null ? "" : minor.toString()} />
      </div>
    </Field>
  );
}
