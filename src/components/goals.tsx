"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { FormOptions } from "@/server/ui-data";
import { Dialog } from "./dialog";
import { Checkbox, Select, TextInput, useErrorText } from "./form";
import { MoneyInput } from "./money-input";
import { btn, Notice } from "./ui";

type Opts = Pick<FormOptions, "accounts" | "categories" | "currencies">;

export interface GoalValue {
  id?: string;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  contributionAmount: string | null;
  contributionPercent: string | null;
  contributionMode: "BILL" | "AUTO";
  fundingAccountId: string | null;
  savingsAccountId: string | null;
  isEmergencyFund: boolean;
}

function GoalForm({ opts, base, exp, initial, onDone }: { opts: Opts; base: string; exp: number; initial?: GoalValue; onDone: () => void }) {
  const t = useTranslations("goals");
  const tc = useTranslations("common");
  const errText = useErrorText("goals");
  const router = useRouter();
  const [mode, setMode] = useState(initial?.contributionMode ?? "BILL");
  const [error, setError] = useState<string | null>(null);
  const savings = opts.accounts.filter((a) => a.role === "SAVINGS" || a.type === "INVESTMENT");
  const daily = opts.accounts.filter((a) => a.role === "DAILY");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const body = {
          name: f.get("name"),
          targetAmount: f.get("targetAmount"),
          targetDate: f.get("targetDate") || null,
          contributionAmount: f.get("contributionAmount") || null,
          contributionPercent: f.get("contributionAmount") ? null : String(f.get("contributionPercent") || "").replace(",", ".") || null,
          contributionMode: mode,
          fundingAccountId: mode === "AUTO" ? f.get("fundingAccountId") : null,
          savingsAccountId: f.get("savingsAccountId") || null,
          isEmergencyFund: f.get("emergency") === "on",
        };
        setError(null);
        try {
          if (initial?.id) await api(`/api/v1/goals/${initial.id}`, { method: "PATCH", body });
          else await api("/api/v1/goals", { body });
          await api("/api/v1/periods/sync", { body: {} });
          router.refresh();
          onDone();
        } catch (err) {
          setError(errText(err));
        }
      }}
    >
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <TextInput label={t("fields.name")} name="name" defaultValue={initial?.name} required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label={t("fields.target")} name="targetAmount" exp={exp} currency={base} defaultMinor={initial?.targetAmount} required />
        <TextInput label={`${t("fields.targetDate")} (${tc("optional")})`} name="targetDate" type="date" defaultValue={initial?.targetDate ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label={t("fields.contribution")} name="contributionAmount" exp={exp} currency={base} defaultMinor={initial?.contributionAmount} />
        <TextInput label={t("fields.contributionPercent")} name="contributionPercent" inputMode="decimal" defaultValue={initial?.contributionPercent ?? ""} />
      </div>
      <Select label={t("fields.savings")} name="savingsAccountId" defaultValue={initial?.savingsAccountId ?? savings[0]?.id ?? ""}>
        <option value="">{tc("none")}</option>
        {savings.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-[550] text-ink">{t("fields.mode")}</legend>
        {(["BILL", "AUTO"] as const).map((m) => (
          <label key={m} className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="size-5 accent-[var(--accent)]" />
            {t(`fields.${m}`)}
          </label>
        ))}
      </fieldset>
      {mode === "AUTO" ? (
        <Select label={t("fields.from")} name="fundingAccountId" defaultValue={initial?.fundingAccountId ?? daily[0]?.id ?? ""}>
          {daily.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Checkbox label={t("fields.emergency")} name="emergency" defaultChecked={initial?.isEmergencyFund} />
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

export function GoalButton({ opts, base, exp, initial, label, variant = "primary" }: { opts: Opts; base: string; exp: number; initial?: GoalValue; label: string; variant?: "primary" | "secondary" | "ghost" }) {
  const t = useTranslations("goals");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={btn[variant]} onClick={() => setOpen(true)}>
        {variant === "primary" ? <Plus size={18} strokeWidth={1.75} aria-hidden /> : null}
        {label}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={initial?.id ? t("edit") : t("add")}>
        <GoalForm opts={opts} base={base} exp={exp} initial={initial} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

/** Deposit = TRANSFER into a savings account with goalId. Allocate = set aside money already there. */
export function GoalMoneyButton({ kind, goal, opts, base, exp, today }: { kind: "deposit" | "allocate"; goal: { id: string; name: string }; opts: Opts; base: string; exp: number; today: string }) {
  const t = useTranslations("goals");
  const errText = useErrorText("goals");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savings = opts.accounts.filter((a) => a.role === "SAVINGS" || a.type === "INVESTMENT");
  const daily = opts.accounts.filter((a) => a.role === "DAILY");
  const title = kind === "deposit" ? t("depositTitle", { name: goal.name }) : t("allocateTitle", { name: goal.name });
  return (
    <>
      <button type="button" className={kind === "deposit" ? btn.secondary : btn.ghost} onClick={() => setOpen(true)} aria-label={`${kind === "deposit" ? t("deposit") : t("allocate")}: ${goal.name}`} disabled={!savings.length}>
        {kind === "deposit" ? t("deposit") : t("allocate")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError(null);
            try {
              if (kind === "deposit")
                await api("/api/v1/transactions", { body: { type: "TRANSFER", occurredOn: f.get("date"), accountId: f.get("from"), counterAccountId: f.get("to"), amount: f.get("amount"), goalId: goal.id, payee: goal.name } });
              else await api(`/api/v1/goals/${goal.id}/allocate`, { body: { accountId: f.get("to"), amount: f.get("amount") } });
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(errText(err));
            }
          }}
        >
          {error ? <Notice tone="warn">{error}</Notice> : null}
          {kind === "deposit" ? (
            <Select label={t("fields.from")} name="from">
              {daily.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Select label={t("fields.savings")} name="to">
            {savings.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <MoneyInput label={t("fields.amount")} name="amount" exp={exp} currency={base} required />
          {kind === "deposit" ? <TextInput label={t("fields.date")} name="date" type="date" defaultValue={today} required /> : null}
          <button type="submit" className={btn.primary + " w-full"}>
            {kind === "deposit" ? t("deposit") : t("allocate")}
          </button>
        </form>
      </Dialog>
    </>
  );
}

export function WithdrawButton({ opts, base, exp, today, intl, goals }: { opts: Opts; base: string; exp: number; today: string; intl: string; goals: Array<{ id: string; name: string; byAccount: Record<string, string> }> }) {
  const t = useTranslations("goals");
  const errText = useErrorText("goals");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const savings = opts.accounts.filter((a) => a.role === "SAVINGS" || a.type === "INVESTMENT");
  const daily = opts.accounts.filter((a) => a.role === "DAILY");
  const fromId = from || savings[0]?.id || "";
  const relevant = goals.filter((g) => g.byAccount[fromId]);
  return (
    <>
      <button type="button" className={btn.secondary} onClick={() => setOpen(true)} disabled={!savings.length || !daily.length}>
        {t("withdraw")}
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setShortfall(null);
        }}
        title={t("withdrawTitle")}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const take = shortfall
              ? relevant.map((g) => ({ goalId: g.id, amount: String(f.get(`take-${g.id}`) || "0") })).filter((x) => x.amount !== "0" && x.amount !== "")
              : undefined;
            setError(null);
            try {
              await api("/api/v1/goals/withdraw", { body: { fromAccountId: fromId, toAccountId: f.get("to"), amount: f.get("amount"), date: f.get("date"), take } });
              setOpen(false);
              setShortfall(null);
              router.refresh();
            } catch (err) {
              if (err instanceof ApiError && err.code === "choose_goals") setShortfall((err.details as { shortfall: string }).shortfall);
              else setError(errText(err));
            }
          }}
        >
          {error ? <Notice tone="warn">{error}</Notice> : null}
          <Select label={t("fields.savings")} value={fromId} onChange={(e) => setFrom(e.target.value)}>
            {savings.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select label={t("fields.to")} name="to">
            {daily.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <MoneyInput label={t("fields.amount")} name="amount" exp={exp} currency={base} required />
          <TextInput label={t("fields.date")} name="date" type="date" defaultValue={today} required />
          {shortfall ? (
            <fieldset className="space-y-3 rounded-btn border border-warning/50 bg-warning-soft p-3">
              <legend className="px-1 text-sm font-[600] text-warning">{t("chooseGoals", { amount: money(BigInt(shortfall), base, intl, { exp }) })}</legend>
              {relevant.map((g, i) => (
                <MoneyInput key={g.id} label={`${g.name} (${money(BigInt(g.byAccount[fromId]!), base, intl, { exp })})`} name={`take-${g.id}`} exp={exp} currency={base} defaultMinor={i === 0 ? shortfall : null} />
              ))}
            </fieldset>
          ) : null}
          <button type="submit" className={btn.primary + " w-full"}>
            {t("withdraw")}
          </button>
        </form>
      </Dialog>
    </>
  );
}
