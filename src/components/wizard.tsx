"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { Draft, Topic, TopicState } from "@/server/onboarding/draft";
import { Checkbox, Select, TextInput, useErrorText } from "./form";
import { MoneyInput } from "./money-input";
import { btn, Card, Notice, cx } from "./ui";

const TOPICS: Topic[] = ["basics", "payday", "accounts", "wallets", "debts", "assets", "bills", "goals"];
const TYPES: Partial<Record<Topic, Draft["accounts"][number]["type"][]>> = {
  accounts: ["BANK"],
  wallets: ["EWALLET", "CASH"],
  debts: ["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"],
};
const TIMEZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Tokyo", "Europe/London", "Europe/Amsterdam", "America/New_York", "Australia/Sydney", "UTC"];

type Acc = Draft["accounts"][number];

export function Wizard({ initial, topics: initialTopics, currencies, assetTypes, onSwitchToAi }: { initial: Draft; topics: TopicState; currencies: Array<{ code: string; exponent: number }>; assetTypes: Array<{ key: string; name: string }>; onSwitchToAi?: () => void }) {
  const t = useTranslations("onboarding");
  const ta = useTranslations("accounts");
  const ti = useTranslations("invest");
  const errText = useErrorText("onboarding");
  const [d, setD] = useState<Draft>(initial);
  const [topics, setTopics] = useState<TopicState>(initialTopics);
  const firstTodo = TOPICS.findIndex((x) => initialTopics[x] === "todo");
  const [step, setStep] = useState(firstTodo < 0 ? TOPICS.length : firstTodo);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = d.basics.baseCurrency;
  const exp = currencies.find((c) => c.code === base)?.exponent ?? 0;
  const intl = d.basics.locale === "en" ? "en-GB" : "id-ID";
  const fmt = (v: string) => money(BigInt(v || "0"), base, intl, { exp });

  const persist = async (next: Draft, nt: TopicState) => {
    await api("/api/v1/onboarding", { method: "PUT", body: { data: next, topics: nt, path: "MANUAL" } });
  };
  const go = async (status: "done" | "skipped", to: number) => {
    setError(null);
    const nt = step < TOPICS.length ? { ...topics, [TOPICS[step]!]: status } : topics;
    try {
      await persist(d, nt);
      setTopics(nt);
      setStep(to);
    } catch (e) {
      setError(errText(e));
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/onboarding/commit", { body: { data: d } });
      document.cookie = `locale=${d.basics.locale}; path=/; max-age=31536000; samesite=lax`;
      window.location.assign("/");
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };

  const setAccounts = (topic: Topic, rows: Acc[]) => setD({ ...d, accounts: [...d.accounts.filter((a) => !TYPES[topic]!.includes(a.type)), ...rows] });
  const topic = TOPICS[step];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label={t("title")} className="min-w-0">
        <ol className="relative flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {[...TOPICS, "summary" as const].map((k, i) => (
            <li key={k} className="shrink-0">
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cx(
                  "flex min-h-11 w-full items-center gap-2 rounded-btn px-3 text-left text-sm font-[550]",
                  i === step ? "bg-accent-soft text-on-accent-soft" : "text-ink hover:bg-surface-2",
                )}
              >
                <span className={cx("grid size-6 shrink-0 place-items-center rounded-full border text-xs", k !== "summary" && topics[k] === "done" ? "border-accent bg-accent text-on-accent" : "border-line-strong/60")}>
                  {k !== "summary" && topics[k] === "done" ? <Check size={14} strokeWidth={2} aria-hidden /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{k === "summary" ? t("review") : t(`topics.${k}`)}</span>
                {k !== "summary" ? <span className="sr-only">({t(`status.${topics[k]}`)})</span> : null}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <Card className="min-w-0 space-y-5 p-5 md:p-6">
        {error ? <Notice tone="warn">{error}</Notice> : null}
        {topic ? (
          <>
            <div>
              <p className="text-xs font-[600] uppercase tracking-[0.04em] text-muted">{t("progress", { n: step + 1, total: TOPICS.length })}</p>
              <h2 className="mt-1 text-xl font-[650] text-ink">{t(`topics.${topic}`)}</h2>
            </div>

            {topic === "basics" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label={t("householdName")} value={d.basics.householdName ?? ""} onChange={(e) => setD({ ...d, basics: { ...d.basics, householdName: e.target.value } })} maxLength={80} />
                <Select label={t("baseCurrency")} value={base} onChange={(e) => setD({ ...d, basics: { ...d.basics, baseCurrency: e.target.value } })}>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
                <Select label={t("timezone")} value={d.basics.timezone} onChange={(e) => setD({ ...d, basics: { ...d.basics, timezone: e.target.value } })}>
                  {(TIMEZONES.includes(d.basics.timezone) ? TIMEZONES : [d.basics.timezone, ...TIMEZONES]).map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
                <Select label={t("language")} value={d.basics.locale} onChange={(e) => setD({ ...d, basics: { ...d.basics, locale: e.target.value as "id" | "en" } })}>
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </Select>
              </div>
            ) : null}

            {topic === "payday" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Select label={t("paydayDay")} value={String(d.payday.day)} onChange={(e) => setD({ ...d, payday: { ...d.payday, day: e.target.value === "last" ? "last" : Number(e.target.value) } })}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                  <option value="last">{t("paydayLast")}</option>
                </Select>
                <Select label={t("weekend")} value={d.payday.shiftWeekend} onChange={(e) => setD({ ...d, payday: { ...d.payday, shiftWeekend: e.target.value as "before" } })}>
                  <option value="before">{t("weekendBefore")}</option>
                  <option value="after">{t("weekendAfter")}</option>
                  <option value="none">{t("weekendNone")}</option>
                </Select>
                <Select label={t("allowanceUnit")} value={d.payday.allowanceUnit} onChange={(e) => setD({ ...d, payday: { ...d.payday, allowanceUnit: e.target.value as "DAILY" } })}>
                  <option value="DAILY">{t("unitDaily")}</option>
                  <option value="WEEKLY">{t("unitWeekly")}</option>
                </Select>
                <MoneyInput label={t("salary")} name="salary" exp={exp} currency={base} defaultMinor={d.payday.salary ?? null} onMinor={(v) => setD((x) => ({ ...x, payday: { ...x.payday, salary: v } }))} />
                <Select label={t("salaryAccount")} value={d.payday.salaryAccount ?? ""} onChange={(e) => setD({ ...d, payday: { ...d.payday, salaryAccount: e.target.value || null } })}>
                  <option value="">{t("none")}</option>
                  {d.accounts
                    .filter((a) => a.type === "BANK" || a.type === "EWALLET")
                    .map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </div>
            ) : null}

            {TYPES[topic] ? (
              <RowsEditor
                rows={d.accounts.filter((a) => TYPES[topic]!.includes(a.type))}
                make={() => ({ name: "", type: TYPES[topic]![0]!, balance: "0" }) as Acc}
                onChange={(rows) => setAccounts(topic, rows)}
                removeLabel={(r) => t("removeRow", { name: r.name || "" })}
                addLabel={t("addRow")}
                render={(r, set) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput label={t("name")} value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} maxLength={80} required />
                    {TYPES[topic]!.length > 1 ? (
                      <Select label={t("type")} value={r.type} onChange={(e) => set({ ...r, type: e.target.value as Acc["type"] })}>
                        {TYPES[topic]!.map((x) => (
                          <option key={x} value={x}>
                            {ta(`type.${x}`)}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                    {r.type !== "CASH" && r.type !== "PERSONAL_DEBT" ? <TextInput label={t("institution")} value={r.institution ?? ""} onChange={(e) => set({ ...r, institution: e.target.value || null })} maxLength={80} /> : null}
                    {r.type === "BANK" || r.type === "CREDIT_CARD" ? <TextInput label={t("last4")} value={r.last4 ?? ""} inputMode="numeric" maxLength={4} pattern="\d{4}" onChange={(e) => set({ ...r, last4: e.target.value.replace(/\D/g, "").slice(0, 4) || null })} /> : null}
                    {topic === "accounts" ? (
                      <Select label={t("use")} value={r.role ?? "DAILY"} onChange={(e) => set({ ...r, role: e.target.value as "DAILY" })}>
                        <option value="DAILY">{ta("role.DAILY")}</option>
                        <option value="SAVINGS">{ta("role.SAVINGS")}</option>
                      </Select>
                    ) : null}
                    <MoneyInput label={topic === "debts" ? t("owed") : t("balance")} name="b" exp={exp} currency={base} defaultMinor={r.balance} onMinor={(v) => set({ ...r, balance: v ?? "0" })} />
                    {r.type === "CREDIT_CARD" || r.type === "PAYLATER" ? (
                      <>
                        <MoneyInput label={t("limit")} name="l" exp={exp} currency={base} defaultMinor={r.creditLimit ?? null} onMinor={(v) => set({ ...r, creditLimit: v })} />
                        <div className="grid grid-cols-2 gap-3">
                          <TextInput label={t("statementDay")} type="number" min={1} max={31} value={r.statementDay ?? ""} onChange={(e) => set({ ...r, statementDay: e.target.value ? Number(e.target.value) : null })} />
                          <TextInput label={t("dueDay")} type="number" min={1} max={31} value={r.dueDay ?? ""} onChange={(e) => set({ ...r, dueDay: e.target.value ? Number(e.target.value) : null })} />
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              />
            ) : null}

            {topic === "assets" ? (
              <RowsEditor
                rows={d.assets}
                make={() => ({ name: "", typeKey: assetTypes[0]?.key ?? "other", account: d.accounts[0]?.name ?? "", units: "0", unitPrice: "0" })}
                onChange={(rows) => setD({ ...d, assets: rows })}
                removeLabel={(r) => t("removeRow", { name: r.name })}
                addLabel={t("addRow")}
                render={(r, set) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput label={t("assetName")} value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} required />
                    <Select label={t("assetType")} value={r.typeKey} onChange={(e) => set({ ...r, typeKey: e.target.value })}>
                      {assetTypes.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.name}
                        </option>
                      ))}
                    </Select>
                    <Select label={t("assetAccount")} value={r.account} onChange={(e) => set({ ...r, account: e.target.value })}>
                      {d.accounts
                        .filter((a) => ["BANK", "CASH", "EWALLET", "INVESTMENT"].includes(a.type))
                        .map((a) => (
                          <option key={a.name} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                    </Select>
                    <div className="grid grid-cols-2 gap-3">
                      <TextInput label={t("units")} inputMode="decimal" value={r.units} onChange={(e) => set({ ...r, units: e.target.value.replace(",", ".") })} />
                      <TextInput label={t("unitPrice")} help={ti("unitPriceHelp", { unit: "unit" })} inputMode="decimal" value={r.unitPrice} onChange={(e) => set({ ...r, unitPrice: e.target.value.replace(/\./g, "").replace(",", ".") })} />
                    </div>
                  </div>
                )}
              />
            ) : null}

            {topic === "bills" ? (
              <RowsEditor
                rows={d.bills}
                make={() => ({ name: "", amount: "0", day: 1, account: d.accounts[0]?.name ?? null, auto: false })}
                onChange={(rows) => setD({ ...d, bills: rows })}
                removeLabel={(r) => t("removeRow", { name: r.name })}
                addLabel={t("addRow")}
                render={(r, set) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput label={t("billName")} value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} required />
                    <MoneyInput label={t("billAmount")} name="a" exp={exp} currency={base} defaultMinor={r.amount} onMinor={(v) => set({ ...r, amount: v ?? "0" })} />
                    <TextInput label={t("billDay")} type="number" min={1} max={31} value={r.day} onChange={(e) => set({ ...r, day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
                    <Select label={t("salaryAccount")} value={r.account ?? ""} onChange={(e) => set({ ...r, account: e.target.value })}>
                      {d.accounts.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                    <Checkbox label={t("billAuto")} checked={r.auto} onChange={(e) => set({ ...r, auto: e.target.checked })} />
                  </div>
                )}
              />
            ) : null}

            {topic === "goals" ? (
              <RowsEditor
                rows={d.goals}
                make={() => ({ name: "", target: "0", monthly: null, emergency: false })}
                onChange={(rows) => setD({ ...d, goals: rows })}
                removeLabel={(r) => t("removeRow", { name: r.name })}
                addLabel={t("addRow")}
                render={(r, set) => (
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput label={t("goalName")} value={r.name} onChange={(e) => set({ ...r, name: e.target.value })} required />
                    <MoneyInput label={t("goalTarget")} name="t" exp={exp} currency={base} defaultMinor={r.target} onMinor={(v) => set({ ...r, target: v ?? "0" })} />
                    <MoneyInput label={t("goalMonthly")} name="m" exp={exp} currency={base} defaultMinor={r.monthly ?? null} onMinor={(v) => set({ ...r, monthly: v })} />
                    <Checkbox label={t("goalEmergency")} checked={r.emergency} onChange={(e) => set({ ...r, emergency: e.target.checked })} />
                  </div>
                )}
              />
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
              <button type="button" className={btn.ghost} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                {t("back")}
              </button>
              <div className="flex gap-2">
                <button type="button" className={btn.secondary} onClick={() => go("skipped", step + 1)}>
                  {t("skip")}
                </button>
                <button type="button" className={btn.primary} onClick={() => go("done", step + 1)}>
                  {step === TOPICS.length - 1 ? t("review") : t("next")}
                </button>
              </div>
            </div>
            {onSwitchToAi ? (
              <button type="button" className="min-h-11 text-sm font-[600] text-accent underline underline-offset-4" onClick={onSwitchToAi}>
                {t("switchToAi")}
              </button>
            ) : null}
          </>
        ) : (
          <Summary d={d} fmt={fmt} onEdit={(i) => setStep(i)} onConfirm={confirm} busy={busy} />
        )}
      </Card>
    </div>
  );
}

function RowsEditor<T extends { name: string }>({
  rows,
  make,
  onChange,
  render,
  removeLabel,
  addLabel,
}: {
  rows: T[];
  make: () => T;
  onChange: (rows: T[]) => void;
  render: (row: T, set: (r: T) => void) => React.ReactNode;
  removeLabel: (r: T) => string;
  addLabel: string;
}) {
  // Stable keys so inputs keep focus while typing.
  const [keys, setKeys] = useState(() => rows.map((_, i) => i));
  const [nextKey, setNextKey] = useState(rows.length);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={keys[i] ?? i} className="rounded-card-sm border border-line p-4">
          {render(r, (nr) => onChange(rows.map((x, j) => (j === i ? nr : x))))}
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-btn px-3 text-sm font-[600] text-muted hover:bg-surface-2"
              aria-label={removeLabel(r)}
              onClick={() => {
                onChange(rows.filter((_, j) => j !== i));
                setKeys(keys.filter((_, j) => j !== i));
              }}
            >
              <Trash2 size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={btn.secondary}
        onClick={() => {
          onChange([...rows, make()]);
          setKeys([...keys, nextKey]);
          setNextKey(nextKey + 1);
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}

function Section({ title, editLabel, onEdit, children }: { title: string; editLabel: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="border-b border-line pb-4 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-[650] text-ink">{title}</h3>
        <button type="button" className={btn.ghost} onClick={onEdit} aria-label={`${editLabel}: ${title}`}>
          {editLabel}
        </button>
      </div>
      <div className="mt-1 text-sm text-ink">{children}</div>
    </section>
  );
}

function Summary({ d, fmt, onEdit, onConfirm, busy }: { d: Draft; fmt: (v: string) => string; onEdit: (i: number) => void; onConfirm: () => void; busy: boolean }) {
  const t = useTranslations("onboarding");
  const ta = useTranslations("accounts");
  const list = (items: string[]) => (items.length ? <ul className="space-y-0.5">{items.map((x, k) => <li key={k}>{x}</li>)}</ul> : <p className="text-muted">{t("none")}</p>);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-[650] text-ink">{t("summaryTitle")}</h2>
        <p className="text-sm text-muted">{t("summaryBody")}</p>
      </div>
      <Section editLabel={t("edit")} onEdit={() => onEdit(0)} title={t("topics.basics")}>
        {d.basics.householdName ? `${d.basics.householdName} · ` : ""}
        {d.basics.baseCurrency} · {d.basics.timezone} · {d.basics.locale === "en" ? "English" : "Bahasa Indonesia"}
      </Section>
      <Section editLabel={t("edit")} onEdit={() => onEdit(1)} title={t("topics.payday")}>
        {d.payday.day === "last" ? t("paydayLast") : `${t("paydayDay")}: ${d.payday.day}`}
        {d.payday.salary ? ` · ${fmt(d.payday.salary)}` : ""}
      </Section>
      <Section editLabel={t("edit")} onEdit={() => onEdit(2)} title={t("topics.accounts")}>
        {list(d.accounts.filter((a) => !["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"].includes(a.type)).map((a) => `${a.name} (${ta(`type.${a.type}`)}) · ${fmt(a.balance)}`))}
      </Section>
      <Section editLabel={t("edit")} onEdit={() => onEdit(4)} title={t("topics.debts")}>
        {list(d.accounts.filter((a) => ["CREDIT_CARD", "PAYLATER", "LOAN", "PERSONAL_DEBT"].includes(a.type)).map((a) => `${a.name} (${ta(`type.${a.type}`)}) · ${fmt(a.balance)}`))}
      </Section>
      <Section editLabel={t("edit")} onEdit={() => onEdit(5)} title={t("topics.assets")}>
        {list(d.assets.map((a) => `${a.name} · ${a.units} × ${a.unitPrice}`))}
      </Section>
      <Section editLabel={t("edit")} onEdit={() => onEdit(6)} title={t("topics.bills")}>
        {list(d.bills.map((b) => `${b.name} · ${fmt(b.amount)} · ${b.day}`))}
      </Section>
      <Section editLabel={t("edit")} onEdit={() => onEdit(7)} title={t("topics.goals")}>
        {list(d.goals.map((g) => `${g.name} · ${fmt(g.target)}${g.monthly ? ` (${fmt(g.monthly)})` : ""}`))}
      </Section>
      <button type="button" className={btn.primary + " w-full"} onClick={onConfirm} disabled={busy}>
        {t("confirm")}
      </button>
    </div>
  );
}
