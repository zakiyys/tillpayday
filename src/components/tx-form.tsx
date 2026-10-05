"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import type { FormOptions } from "@/server/ui-data";
import { Checkbox, Select, TextInput, useErrorText } from "./form";
import { MoneyInput } from "./money-input";
import { btn, Notice } from "./ui";

export interface TxFormValue {
  id?: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "ADJUSTMENT";
  occurredOn: string;
  accountId: string;
  counterAccountId: string | null;
  amount: string;
  counterAmount: string | null;
  categoryId: string | null;
  payee: string | null;
  note: string | null;
  excludeFromAllowance: boolean;
  fxRate: string | null;
}

export function TxForm({
  opts,
  base,
  today,
  initial,
  defaultAccountId,
  onDone,
}: {
  opts: Pick<FormOptions, "accounts" | "categories" | "currencies">;
  base: string;
  today: string;
  initial?: Partial<TxFormValue>;
  defaultAccountId?: string;
  onDone: () => void;
}) {
  const t = useTranslations("tx");
  const tc = useTranslations("common");
  const errText = useErrorText("tx");
  const router = useRouter();
  const [type, setType] = useState<TxFormValue["type"]>(initial?.type ?? "EXPENSE");
  const [accountId, setAccountId] = useState(initial?.accountId ?? defaultAccountId ?? opts.accounts[0]?.id ?? "");
  const [counterId, setCounterId] = useState(initial?.counterAccountId ?? opts.accounts.find((a) => a.id !== accountId)?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const acc = opts.accounts.find((a) => a.id === accountId);
  const counter = opts.accounts.find((a) => a.id === counterId);
  const exp = (c?: string) => opts.currencies.find((x) => x.code === c)?.exponent ?? 2;
  const cats = opts.categories.filter((c) => c.kind === (type === "INCOME" ? "INCOME" : "EXPENSE"));
  const crossCcy = type === "TRANSFER" && acc && counter && acc.currency !== counter.currency;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      type,
      occurredOn: f.get("occurredOn"),
      accountId,
      amount: f.get("amount"),
      note: f.get("note") || null,
      payee: f.get("payee") || null,
    };
    if (type === "TRANSFER") {
      body.counterAccountId = counterId;
      if (crossCcy) body.counterAmount = f.get("counterAmount");
    } else if (type !== "ADJUSTMENT") body.categoryId = f.get("categoryId") || null;
    if (type === "EXPENSE") body.excludeFromAllowance = f.get("exclude") === "on";
    if (acc && acc.currency !== base && type !== "TRANSFER" && f.get("fxRate")) body.fxRate = String(f.get("fxRate")).replace(",", ".");
    setBusy(true);
    setError(null);
    try {
      if (initial?.id) await api(`/api/v1/transactions/${initial.id}`, { method: "PATCH", body });
      else await api("/api/v1/transactions", { body });
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
      <fieldset>
        <legend className="mb-1.5 text-sm font-[550] text-ink">{t("fields.type")}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-btn bg-surface-2 p-1">
          {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((k) => (
            <label key={k} className={"flex min-h-10 cursor-pointer items-center justify-center rounded-[9px] text-sm font-[600] " + (type === k ? "bg-surface text-ink shadow-sm" : "text-muted")}>
              <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
              {t(`type.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput key={`a-${acc?.currency}`} label={t("fields.amount")} name="amount" exp={exp(acc?.currency)} currency={acc?.currency ?? base} defaultMinor={initial?.amount} required />
        <TextInput label={t("fields.date")} name="occurredOn" type="date" defaultValue={initial?.occurredOn ?? today} required />
      </div>
      <Select label={type === "TRANSFER" ? t("fields.from") : t("fields.account")} name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {opts.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.last4 ? ` •${a.last4}` : ""} ({a.currency})
          </option>
        ))}
      </Select>
      {type === "TRANSFER" ? (
        <>
          <Select label={t("fields.to")} name="counterAccountId" value={counterId} onChange={(e) => setCounterId(e.target.value)}>
            {opts.accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.last4 ? ` •${a.last4}` : ""} ({a.currency})
                </option>
              ))}
          </Select>
          {crossCcy ? (
            <MoneyInput key={`c-${counter?.currency}`} label={t("fields.counterAmount")} help={t("fields.counterAmountHelp")} name="counterAmount" exp={exp(counter?.currency)} currency={counter!.currency} defaultMinor={initial?.counterAmount} required />
          ) : null}
        </>
      ) : (
        <Select label={t("fields.category")} name="categoryId" defaultValue={initial?.categoryId ?? cats[0]?.id ?? ""}>
          <option value="">{t("noCategory")}</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {acc && acc.currency !== base && type !== "TRANSFER" ? (
        <TextInput label={t("fields.fxRate")} help={t("fields.fxRateHelp", { base, currency: acc.currency })} name="fxRate" inputMode="decimal" defaultValue={initial?.fxRate ?? ""} />
      ) : null}
      <TextInput label={t("fields.payee")} name="payee" defaultValue={initial?.payee ?? ""} maxLength={120} />
      <TextInput label={t("fields.note")} name="note" defaultValue={initial?.note ?? ""} maxLength={1000} />
      {type === "EXPENSE" ? <Checkbox label={t("fields.excludeFromAllowance")} name="exclude" defaultChecked={initial?.excludeFromAllowance} /> : null}
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
