"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { findInstitution, INSTITUTIONS, type Institution, type InstitutionKind } from "@/lib/institutions";
import { AccountLogo, InstitutionMark } from "./account-logo";
import { Field, inputCls } from "./form";
import { cx } from "./ui";

const KIND_FOR: Record<string, InstitutionKind[]> = {
  BANK: ["BANK"],
  EWALLET: ["EWALLET"],
  INVESTMENT: ["INVESTMENT", "BANK"],
  CREDIT_CARD: ["BANK", "CARD"],
  PAYLATER: ["PAYLATER", "EWALLET"],
  LOAN: ["BANK", "PAYLATER"],
};

/**
 * Bank or provider field with brand logos: typing filters the known institutions, a tap fills the field.
 * Free text stays allowed for anything not on the list.
 */
export function InstitutionPicker({ type, defaultValue, onPick }: { type: string; defaultValue?: string | null; onPick?: (inst: Institution) => void }) {
  const t = useTranslations("accounts");
  const id = useId();
  const [value, setValue] = useState(defaultValue ?? "");
  const kinds = KIND_FOR[type];
  const matches = useMemo(() => {
    if (!kinds) return [];
    const q = value.trim().toLowerCase();
    const pool = INSTITUTIONS.filter((i) => kinds.includes(i.kind));
    // Match the start of any word, so "go" finds GoPay but not Bank Jago.
    const starts = (text: string) => text.split(/[\s.-]+/).some((w) => w.startsWith(q)) || text.startsWith(q);
    const hit = q ? pool.filter((i) => starts(i.name.toLowerCase()) || i.id.startsWith(q) || i.aliases?.some(starts)) : pool;
    return hit.slice(0, q ? 8 : 12);
  }, [value, kinds]);
  if (!kinds) return null;
  const current = findInstitution(value);
  const exact = current && current.name.toLowerCase() === value.trim().toLowerCase();
  return (
    <Field id={id} label={t("fields.institution")} help={t("fields.institutionHelp")}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
          <AccountLogo type={type} institution={value} size={28} />
        </span>
        <input id={id} name="institution" className={inputCls + " pl-12"} value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} autoComplete="off" aria-describedby={`${id}-help`} />
      </div>
      {matches.length && !exact ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("fields.institutionPick")}>
          {matches.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => {
                  setValue(i.name);
                  onPick?.(i);
                }}
                className={cx("press flex min-h-10 items-center gap-2 rounded-chip border border-line bg-surface py-1 pl-1 pr-3 text-sm font-[550] text-ink hover:border-line-strong")}
              >
                <InstitutionMark inst={i} size={28} />
                {i.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
}
