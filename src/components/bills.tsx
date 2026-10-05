"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import type { FormOptions } from "@/server/ui-data";
import { Dialog } from "./dialog";
import { Checkbox, Select, TextInput, useErrorText } from "./form";
import { MoneyInput } from "./money-input";
import { btn, Notice } from "./ui";

type Opts = Pick<FormOptions, "accounts" | "categories" | "currencies">;

export function PayBillButton({ bill, opts, today, label }: { bill: { id: string; name: string; amount: string; kind: string }; opts: Opts; today: string; label: string }) {
  const t = useTranslations("bills");
  const ttx = useTranslations("tx");
  const errText = useErrorText("bills");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const daily = opts.accounts.filter((a) => ["BANK", "EWALLET", "CASH", "CREDIT_CARD", "PAYLATER"].includes(a.type) && (bill.kind === "REGULAR" || !["CREDIT_CARD", "PAYLATER"].includes(a.type)));
  const exp = opts.currencies.find((c) => c.code === daily[0]?.currency)?.exponent ?? 0;
  return (
    <>
      <button type="button" className={btn.secondary} onClick={() => setOpen(true)} aria-label={`${label}: ${bill.name}`}>
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("payTitle", { name: bill.name })}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError(null);
            try {
              await api(`/api/v1/bills/${bill.id}/pay`, { body: { accountId: f.get("accountId"), date: f.get("date"), amount: f.get("amount") || undefined } });
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errText(err));
            }
          }}
        >
          {error ? <Notice tone="warn">{error}</Notice> : null}
          <Select label={t("payFrom")} name="accountId">
            {daily.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </Select>
          <MoneyInput label={ttx("fields.amount")} name="amount" exp={exp} currency={daily[0]?.currency ?? "IDR"} defaultMinor={bill.amount} required />
          <TextInput label={ttx("fields.date")} name="date" type="date" defaultValue={today} required />
          <button type="submit" className={btn.primary + " w-full"}>
            {t("pay")}
          </button>
        </form>
      </Dialog>
    </>
  );
}

export interface RecurringValue {
  id?: string;
  name: string;
  template: { type: "INCOME" | "EXPENSE" | "TRANSFER"; accountId: string; counterAccountId?: string | null; amount: string; categoryId?: string | null };
  schedule: { kind: "MONTHLY"; day: number } | { kind: "PERIOD_OFFSET"; offset: number } | { kind: "WEEKLY"; weekday: number } | { kind: "YEARLY"; month: number; day: number };
  mode: "AUTO_POST" | "CREATE_BILL";
  opensPeriod: boolean;
  startDate: string;
  endDate: string | null;
}

export function RecurringForm({ opts, today, base, initial, onDone }: { opts: Opts; today: string; base: string; initial?: Partial<RecurringValue>; onDone: () => void }) {
  const t = useTranslations("bills");
  const ttx = useTranslations("tx");
  const tc = useTranslations("common");
  const errText = useErrorText("bills");
  const router = useRouter();
  const [type, setType] = useState(initial?.template?.type ?? "EXPENSE");
  const [kind, setKind] = useState(initial?.schedule?.kind ?? "MONTHLY");
  const [accountId, setAccountId] = useState(initial?.template?.accountId ?? opts.accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const acc = opts.accounts.find((a) => a.id === accountId);
  const exp = opts.currencies.find((c) => c.code === (acc?.currency ?? base))?.exponent ?? 0;
  const s = initial?.schedule as Record<string, number> | undefined;
  const weekdays = t.raw("weekdays") as string[];

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const n = (k: string) => Number(f.get(k));
        const schedule =
          kind === "MONTHLY" ? { kind, day: n("day") } : kind === "PERIOD_OFFSET" ? { kind, offset: n("offset") } : kind === "WEEKLY" ? { kind, weekday: n("weekday") } : { kind, month: n("month"), day: n("day") };
        const body = {
          name: f.get("name"),
          template: {
            type,
            accountId,
            counterAccountId: type === "TRANSFER" ? f.get("counterAccountId") : null,
            amount: f.get("amount"),
            categoryId: type === "TRANSFER" ? null : f.get("categoryId") || null,
            payee: f.get("name"),
          },
          schedule,
          mode: type === "EXPENSE" ? f.get("mode") : "AUTO_POST",
          opensPeriod: type === "INCOME" && f.get("opensPeriod") === "on",
          startDate: f.get("startDate"),
          endDate: f.get("endDate") || null,
        };
        setError(null);
        try {
          if (initial?.id) await api(`/api/v1/recurring/${initial.id}`, { method: "PATCH", body });
          else await api("/api/v1/recurring", { body });
          await api("/api/v1/periods/sync", { body: {} });
          router.refresh();
          onDone();
        } catch (err) {
          setError(errText(err));
        }
      }}
    >
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <TextInput label={ttx("fields.payee")} name="name" defaultValue={initial?.name} required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <Select label={ttx("fields.type")} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((k) => (
            <option key={k} value={k}>
              {ttx(`type.${k}`)}
            </option>
          ))}
        </Select>
        <MoneyInput key={acc?.currency} label={ttx("fields.amount")} name="amount" exp={exp} currency={acc?.currency ?? base} defaultMinor={initial?.template?.amount} required />
      </div>
      <Select label={type === "TRANSFER" ? ttx("fields.from") : ttx("fields.account")} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        {opts.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency})
          </option>
        ))}
      </Select>
      {type === "TRANSFER" ? (
        <Select label={ttx("fields.to")} name="counterAccountId" defaultValue={initial?.template?.counterAccountId ?? undefined}>
          {opts.accounts
            .filter((a) => a.id !== accountId)
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </Select>
      ) : (
        <Select label={ttx("fields.category")} name="categoryId" defaultValue={initial?.template?.categoryId ?? ""}>
          <option value="">{ttx("noCategory")}</option>
          {opts.categories
            .filter((c) => c.kind === (type === "INCOME" ? "INCOME" : "EXPENSE"))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
      )}
      <Select label={t("schedule.label")} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        {(["MONTHLY", "PERIOD_OFFSET", "WEEKLY", "YEARLY"] as const).map((k) => (
          <option key={k} value={k}>
            {t(`schedule.${k}`)}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        {kind === "MONTHLY" || kind === "YEARLY" ? <TextInput label={t("schedule.day")} name="day" type="number" min={1} max={31} defaultValue={s?.day ?? 1} required /> : null}
        {kind === "YEARLY" ? <TextInput label={t("schedule.month")} name="month" type="number" min={1} max={12} defaultValue={s?.month ?? 1} required /> : null}
        {kind === "PERIOD_OFFSET" ? <TextInput label={t("schedule.offset")} name="offset" type="number" min={0} max={40} defaultValue={s?.offset ?? 0} required /> : null}
        {kind === "WEEKLY" ? (
          <Select label={t("schedule.weekday")} name="weekday" defaultValue={String(s?.weekday ?? 1)}>
            {weekdays.map((w, i) => (
              <option key={w} value={i}>
                {w}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      {type === "EXPENSE" ? (
        <Select label={t("mode.label")} name="mode" defaultValue={initial?.mode ?? "CREATE_BILL"}>
          <option value="CREATE_BILL">{t("mode.CREATE_BILL")}</option>
          <option value="AUTO_POST">{t("mode.AUTO_POST")}</option>
        </Select>
      ) : null}
      {type === "INCOME" ? <Checkbox label={t("opensPeriod")} name="opensPeriod" defaultChecked={initial?.opensPeriod} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t("startDate")} name="startDate" type="date" defaultValue={initial?.startDate ?? today} required />
        <TextInput label={`${t("endDate")} (${tc("optional")})`} name="endDate" type="date" defaultValue={initial?.endDate ?? ""} />
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" className={btn.ghost + " flex-1"} onClick={onDone}>
          {tc("cancel")}
        </button>
        <button type="submit" className={btn.primary + " flex-1"}>
          {tc("save")}
        </button>
      </div>
    </form>
  );
}

export function RecurringButton({ opts, today, base, initial, label, variant = "primary" }: { opts: Opts; today: string; base: string; initial?: Partial<RecurringValue>; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  const t = useTranslations("bills");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={btn[variant]} onClick={() => setOpen(true)} disabled={!opts.accounts.length}>
        {variant === "primary" ? <Plus size={18} strokeWidth={1.75} aria-hidden /> : null}
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={initial?.id ? t("editRecurring") : t("addRecurring")}>
        <RecurringForm opts={opts} today={today} base={base} initial={initial} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function BillStatusButton({ id, status, label }: { id: string; status: "SKIPPED" | "UNPAID"; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={btn.ghost}
      onClick={async () => {
        await api(`/api/v1/bills/${id}/status`, { body: { status } });
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}

export function ToggleRecurring({ id, active, label }: { id: string; active: boolean; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={btn.ghost}
      onClick={async () => {
        await api(`/api/v1/recurring/${id}`, { method: "PATCH", body: { active: !active } });
        await api("/api/v1/periods/sync", { body: {} });
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
