"use client";

import { useId, useState } from "react";
import { useLocale } from "next-intl";
import { Field, inputCls } from "./form";
import { majorStrToMinor, minorToInput, parseMajor } from "@/lib/format";
import { currencySymbol } from "@/lib/currency";

/**
 * Digits grouped in the page language ("1500000" reads as "1.500.000"). Three-decimal currencies stay ungrouped:
 * "1.125" would read back as thousands.
 */
function grouped(minor: bigint, exp: number, locale: string) {
  if (exp >= 3) return minorToInput(minor, exp);
  const intl = locale === "en" ? "en-US" : "id-ID";
  return new Intl.NumberFormat(intl, { minimumFractionDigits: 0, maximumFractionDigits: exp }).format(minorToInput(minor, exp) as unknown as number);
}

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
  const locale = useLocale();
  const [text, setText] = useState(defaultMinor != null && defaultMinor !== "" ? grouped(BigInt(defaultMinor), exp, locale) : "");
  const parsed = parseMajor(text);
  const minor = parsed == null ? null : majorStrToMinor(parsed, exp);
  const invalid = text !== "" && (minor == null || (!allowNegative && minor < 0n));
  return (
    <Field id={id} label={label} help={help} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-[600] text-muted">{currencySymbol(currency)}</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className={inputCls + " num pl-14"}
          value={text}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={help ? `${id}-help` : undefined}
          onBlur={() => {
            // Group the digits once the field loses focus, so "1500000" reads as "1.500.000".
            if (minor == null || invalid) return;
            setText(grouped(minor, exp, locale));
          }}
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
