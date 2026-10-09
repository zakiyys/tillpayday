"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { Checkbox, Select, TextInput, useErrorText } from "./form";
import { MoneyInput } from "./money-input";
import { btn, Notice } from "./ui";
import { currencyLabel } from "@/lib/currency";

export interface CurrencyOpt {
  code: string;
  exponent: number;
}

export interface AccountFormValue {
  id?: string;
  name: string;
  type: string;
  institution: string | null;
  last4: string | null;
  aliases: string[];
  currency: string;
  role: string;
  visibility: string;
  isDefaultForInstitution: boolean;
  openingBalance: string;
  openingDate: string;
  creditLimit: string | null;
  statementDay: number | null;
  dueDay: number | null;
  loanTerms: { principal: string; annualRatePct: string; months: number; startDate: string } | null;
}

const ASSET = ["BANK", "EWALLET", "CASH", "INVESTMENT", "RECEIVABLE"];
const CARD = ["CREDIT_CARD", "PAYLATER"];

export function AccountForm({
  initial,
  currencies,
  baseCurrency,
  today,
  showVisibility,
  onDone,
}: {
  initial?: AccountFormValue;
  currencies: CurrencyOpt[];
  baseCurrency: string;
  today: string;
  showVisibility: boolean;
  onDone: () => void;
}) {
  const t = useTranslations("accounts");
  const tc = useTranslations("common");
  const errText = useErrorText("accounts");
  const router = useRouter();
  const [type, setType] = useState(initial?.type ?? "BANK");
  const [currency, setCurrency] = useState(initial?.currency ?? baseCurrency);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const exp = currencies.find((c) => c.code === currency)?.exponent ?? 2;
  const isDebt = !ASSET.includes(type);
  const opening = initial ? (BigInt(initial.openingBalance) < 0n && isDebt ? (-BigInt(initial.openingBalance)).toString() : initial.openingBalance) : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const body: Record<string, unknown> = {
      name: f.get("name"),
      type,
      institution: f.get("institution") || null,
      last4: f.get("last4") || null,
      aliases: String(f.get("aliases") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      currency,
      role: f.get("role") ?? "NONE",
      visibility: f.get("visibility") ?? "SHARED",
      isDefaultForInstitution: f.get("isDefault") === "on",
      openingBalance: f.get("opening") || "0",
      openingDate: f.get("openingDate"),
    };
    if (CARD.includes(type)) Object.assign(body, { creditLimit: f.get("creditLimit") || null, statementDay: num("statementDay"), dueDay: num("dueDay") });
    if (type === "LOAN" && f.get("loanPrincipal"))
      body.loanTerms = { principal: f.get("loanPrincipal"), annualRatePct: String(f.get("loanRate") || "0"), months: num("loanMonths") ?? 12, startDate: f.get("loanStart") || today };
    setBusy(true);
    setError(null);
    try {
      if (initial?.id) await api(`/api/v1/accounts/${initial.id}`, { method: "PATCH", body });
      else await api("/api/v1/accounts", { body });
      router.refresh();
      onDone();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <TextInput label={t("fields.name")} name="name" defaultValue={initial?.name} required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <Select label={t("fields.type")} name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {["BANK", "EWALLET", "CASH", "INVESTMENT", "CREDIT_CARD", "PAYLATER", "LOAN", "RECEIVABLE", "PERSONAL_DEBT"].map((k) => (
            <option key={k} value={k}>
              {t(`type.${k}`)}
            </option>
          ))}
        </Select>
        <Select label={t("fields.currency")} name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {currencyLabel(c.code)}
            </option>
          ))}
        </Select>
      </div>
      {["BANK", "EWALLET", "CASH"].includes(type) ? (
        <Select label={t("role.label")} name="role" defaultValue={initial?.role ?? "DAILY"} help={t("role.help")}>
          {["DAILY", "SAVINGS", "NONE"].map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t("fields.institution")} name="institution" defaultValue={initial?.institution ?? ""} maxLength={80} />
        <TextInput label={t("fields.last4")} name="last4" defaultValue={initial?.last4 ?? ""} inputMode="numeric" pattern="\d{4}" maxLength={4} />
      </div>
      <TextInput label={t("fields.aliases")} help={t("fields.aliasesHelp")} name="aliases" defaultValue={initial?.aliases.join(", ") ?? ""} />
      <Checkbox label={t("fields.isDefault")} help={t("fields.isDefaultHelp")} name="isDefault" defaultChecked={initial?.isDefaultForInstitution} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput key={currency} label={isDebt ? t("fields.openingDebt") : t("fields.opening")} name="opening" exp={exp} currency={currency} defaultMinor={opening} allowNegative={!isDebt} />
        <TextInput label={t("fields.openingDate")} name="openingDate" type="date" defaultValue={initial?.openingDate ?? today} required />
      </div>
      {CARD.includes(type) ? (
        <div className="grid grid-cols-3 gap-3">
          <MoneyInput label={t("fields.creditLimit")} name="creditLimit" exp={exp} currency={currency} defaultMinor={initial?.creditLimit} />
          <TextInput label={t("fields.statementDay")} name="statementDay" type="number" min={1} max={31} defaultValue={initial?.statementDay ?? ""} />
          <TextInput label={t("fields.dueDay")} name="dueDay" type="number" min={1} max={31} defaultValue={initial?.dueDay ?? ""} />
        </div>
      ) : null}
      {type === "LOAN" ? (
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label={t("fields.loanPrincipal")} name="loanPrincipal" exp={exp} currency={currency} defaultMinor={initial?.loanTerms?.principal} />
          <TextInput label={t("fields.loanRate")} name="loanRate" inputMode="decimal" defaultValue={initial?.loanTerms?.annualRatePct ?? ""} />
          <TextInput label={t("fields.loanMonths")} name="loanMonths" type="number" min={1} max={600} defaultValue={initial?.loanTerms?.months ?? ""} />
          <TextInput label={t("fields.loanStart")} name="loanStart" type="date" defaultValue={initial?.loanTerms?.startDate ?? today} />
        </div>
      ) : null}
      {showVisibility ? (
        <Select label={t("fields.visibility")} name="visibility" defaultValue={initial?.visibility ?? "SHARED"}>
          <option value="SHARED">{t("fields.SHARED")}</option>
          <option value="PRIVATE">{t("fields.PRIVATE")}</option>
        </Select>
      ) : null}
      <div className="flex gap-2 pt-2">
        <button type="button" className={btn.ghost + " flex-1"} onClick={onDone}>
          {tc("cancel")}
        </button>
        <button type="submit" className={btn.primary + " flex-1"} disabled={busy}>
          {tc("save")}
        </button>
      </div>
    </form>
  );
}
