"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import { MoneyInput } from "./money-input";
import { useErrorText } from "./form";
import { btn, Card, Notice, Progress, StatusPill, cx } from "./ui";

export interface BudgetRow {
  categoryId: string;
  name: string;
  spent: string;
  limit: string | null;
  suggestion: string | null;
  status: "OK" | "NEAR" | "OVER" | null;
  ratio: number;
}

const TONE = { OK: "ok", NEAR: "near", OVER: "over" } as const;

/**
 * Budgets read as one list: spent against the limit, what is left, and the state in words. Limits are changed in
 * an explicit edit mode, so the page is not a wall of inputs and nothing changes by accident.
 */
export function BudgetEditor({ periodId, rows, currency, exp, intl, editable }: { periodId: string; rows: BudgetRow[]; currency: string; exp: number; intl: string; editable: boolean }) {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const errText = useErrorText("budgets");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string | null>>(() => Object.fromEntries(rows.map((r) => [r.categoryId, r.limit])));
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const fmt = (v: string | bigint) => money(BigInt(v), currency, intl, { exp });
  const hasSuggestions = rows.some((r) => r.suggestion);

  const save = async (vals: Record<string, string | null>, suggested: boolean) => {
    setMsg(null);
    setBusy(true);
    try {
      await api("/api/v1/budgets", { body: { periodId, items: rows.map((r) => ({ categoryId: r.categoryId, limit: vals[r.categoryId] || null, suggested })) } });
      setMsg({ tone: "info", text: t("saved") });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setMsg({ tone: "warn", text: errText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {editable ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">{editing ? t("editHelp") : hasSuggestions ? t("viewHelp") : t("noHistory")}</p>
          {!editing ? (
            <div className="flex flex-wrap gap-2">
              {hasSuggestions ? (
                <button
                  type="button"
                  className={btn.secondary}
                  disabled={busy}
                  onClick={() => {
                    const v = Object.fromEntries(rows.map((r) => [r.categoryId, r.suggestion ?? values[r.categoryId] ?? null]));
                    setValues(v);
                    setVersion((x) => x + 1);
                    void save(v, true);
                  }}
                >
                  {t("applySuggestions")}
                </button>
              ) : null}
              <button type="button" className={btn.primary} onClick={() => setEditing(true)}>
                <Pencil size={16} strokeWidth={2} aria-hidden />
                {t("edit")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <Card flush>
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const left = r.limit ? BigInt(r.limit) - BigInt(r.spent) : null;
            return (
              <li key={`${r.categoryId}-${version}`} className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate font-[650] text-ink">{r.name}</h3>
                  {r.status ? <StatusPill tone={TONE[r.status]}>{t(`status.${r.status}`)}</StatusPill> : <StatusPill tone="neutral">{t("noLimit")}</StatusPill>}
                </div>
                {r.limit ? (
                  <div className="mt-2">
                    <Progress ratio={r.ratio} label={r.name} tone={r.status ? TONE[r.status] : "ok"} />
                  </div>
                ) : null}
                <div className="num mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="text-ink">{r.limit ? t("spent", { spent: fmt(r.spent), limit: fmt(r.limit) }) : t("spentOnly", { spent: fmt(r.spent) })}</span>
                  {left != null ? <span className={cx(left < 0n ? "font-[650] text-clay-ink" : "text-muted")}>{left < 0n ? t("overBy", { amount: fmt(-left) }) : t("left", { amount: fmt(left) })}</span> : null}
                </div>
                {editing ? (
                  <div className="mt-3">
                    <MoneyInput
                      label={t("limit", { name: r.name })}
                      help={r.suggestion ? t("suggestion", { amount: fmt(r.suggestion) }) : t("limitHelp")}
                      name={`limit-${r.categoryId}`}
                      exp={exp}
                      currency={currency}
                      defaultMinor={values[r.categoryId]}
                      onMinor={(v) => setValues((s) => ({ ...s, [r.categoryId]: v }))}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
      {editing ? (
        <div className="sticky bottom-28 z-10 flex gap-2 rounded-card-sm border border-line bg-surface/95 p-2 shadow-float backdrop-blur lg:bottom-4">
          <button type="button" className={btn.ghost + " flex-1"} onClick={() => { setEditing(false); setValues(Object.fromEntries(rows.map((r) => [r.categoryId, r.limit]))); setVersion((x) => x + 1); }}>
            {tc("cancel")}
          </button>
          <button type="button" className={btn.primary + " flex-1"} disabled={busy} onClick={() => save(values, false)}>
            {t("saveLimits")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
