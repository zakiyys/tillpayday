"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { MoneyInput } from "./money-input";
import { Select, TextInput, useErrorText } from "./form";
import { btn, Card, Notice } from "./ui";

/** Simulation form (SPEC 11.6): the same functions the input bar uses for "what if" questions. */
export function SimulateForm({ goals, currency, exp }: { goals: string[]; currency: string; exp: number }) {
  const t = useTranslations("dash");
  const errText = useErrorText();
  const [kind, setKind] = useState<"purchase" | "goal">("purchase");
  const [amount, setAmount] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="max-w-2xl">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setError(null);
          try {
            const body = kind === "purchase" ? { kind, amount, months: Number(f.get("months")) || 1 } : { kind, amount, goal: (f.get("goal") as string) || null };
            setOut((await api<{ text: string }>("/api/v1/simulate", { body })).text);
          } catch (err) {
            setError(errText(err));
          }
        }}
      >
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-[550] text-ink">{t("simulate")}</legend>
          <div className="grid grid-cols-2 gap-1 rounded-btn bg-surface-2 p-1">
            {(["purchase", "goal"] as const).map((k) => (
              <label key={k} className={"flex min-h-10 cursor-pointer items-center justify-center rounded-[9px] text-sm font-[600] " + (kind === k ? "bg-surface text-ink shadow-sm" : "text-muted")}>
                <input type="radio" name="kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
                {k === "purchase" ? t("simPurchase") : t("simGoal")}
              </label>
            ))}
          </div>
        </fieldset>
        <MoneyInput label={t("simAmount")} name="amount" exp={exp} currency={currency} onMinor={setAmount} required />
        {kind === "purchase" ? (
          <TextInput label={t("simMonths")} name="months" type="number" min={1} max={60} defaultValue={1} />
        ) : (
          <Select label={t("simGoalName")} name="goal">
            {goals.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        )}
        <div className="sm:col-span-2">
          <button type="submit" className={btn.secondary} disabled={!amount || (kind === "goal" && !goals.length)}>
            {t("simRun")}
          </button>
        </div>
      </form>
      {error ? (
        <div className="mt-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}
      {out ? <p className="mt-3 rounded-btn bg-surface-2 p-3 text-sm text-ink" role="status">{out}</p> : null}
    </Card>
  );
}
