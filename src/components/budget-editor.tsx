"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import { MoneyInput } from "./money-input";
import { useErrorText } from "./form";
import { btn, Card, Notice, Progress, cx } from "./ui";

export interface BudgetRow {
  categoryId: string;
  name: string;
  spent: string;
  limit: string | null;
  suggestion: string | null;
  status: "OK" | "NEAR" | "OVER" | null;
  ratio: number;
}

export function BudgetEditor({ periodId, rows, currency, exp, intl, editable }: { periodId: string; rows: BudgetRow[]; currency: string; exp: number; intl: string; editable: boolean }) {
  const t = useTranslations("budgets");
  const errText = useErrorText("budgets");
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string | null>>(() => Object.fromEntries(rows.map((r) => [r.categoryId, r.limit])));
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const fmt = (v: string) => money(BigInt(v), currency, intl, { exp });
  const hasSuggestions = rows.some((r) => r.suggestion);

  const save = async (vals: Record<string, string | null>, suggested: boolean) => {
    setMsg(null);
    try {
      await api("/api/v1/budgets", { body: { periodId, items: rows.map((r) => ({ categoryId: r.categoryId, limit: vals[r.categoryId] || null, suggested })) } });
      setMsg({ tone: "info", text: t("saved") });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "warn", text: errText(e) });
    }
  };

  return (
    <div className="space-y-3">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {editable && !hasSuggestions ? <p className="text-sm text-muted">{t("noHistory")}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={`${r.categoryId}-${version}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="truncate font-[600] text-ink">{r.name}</h3>
              {r.status ? (
                <span className={cx("shrink-0 text-xs font-[650]", r.status === "OK" ? "text-muted" : "text-warning")}>{t(`status.${r.status}`)}</span>
              ) : null}
            </div>
            <p className="num mt-1 text-sm text-muted">{r.limit ? t("spent", { spent: fmt(r.spent), limit: fmt(r.limit) }) : t("spentOnly", { spent: fmt(r.spent) })}</p>
            {r.limit ? (
              <div className="mt-2">
                <Progress ratio={r.ratio} label={r.name} warn={r.status !== "OK"} />
              </div>
            ) : null}
            {editable ? (
              <div className="mt-3">
                <MoneyInput
                  label={t("limit", { name: r.name })}
                  help={r.suggestion ? t("suggestion", { amount: fmt(r.suggestion) }) : undefined}
                  name={`limit-${r.categoryId}`}
                  exp={exp}
                  currency={currency}
                  defaultMinor={values[r.categoryId]}
                  onMinor={(v) => setValues((s) => ({ ...s, [r.categoryId]: v }))}
                />
              </div>
            ) : null}
          </Card>
        ))}
      </div>
      {editable ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={() => save(values, false)}>
            {t("saveLimits")}
          </button>
          {hasSuggestions ? (
            <button
              type="button"
              className={btn.secondary}
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
        </div>
      ) : null}
    </div>
  );
}
