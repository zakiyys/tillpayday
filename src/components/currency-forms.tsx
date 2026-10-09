"use client";

import { useTranslations } from "next-intl";
import { FormDialog } from "./form-dialog";
import { Select, TextInput } from "./form";
import { currencyLabel } from "@/lib/currency";

export function CurrencyButton() {
  const t = useTranslations("settings.currencies");
  return (
    <FormDialog
      label={t("add")}
      title={t("add")}
      endpoint="/api/v1/currencies"
      ns="settings.currencies"
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({
        code: String(f.get("code")).toUpperCase(),
        exponent: Number(f.get("exponent")),
        symbol: f.get("symbol"),
        smallDiffThreshold: f.get("threshold") ? String(f.get("threshold")).replace(/\D/g, "") : null,
      })}
    >
      <div className="grid grid-cols-3 gap-3">
        <TextInput label={t("code")} name="code" required pattern="[A-Za-z]{3}" maxLength={3} />
        <TextInput label={t("exponent")} name="exponent" type="number" min={0} max={4} defaultValue={2} required />
        <TextInput label={t("symbol")} name="symbol" required maxLength={8} />
      </div>
      <TextInput label={t("threshold")} help={t("thresholdHelp")} name="threshold" inputMode="numeric" />
    </FormDialog>
  );
}

export function RateButton({ currencies, base, today }: { currencies: string[]; base: string; today: string }) {
  const t = useTranslations("settings.currencies");
  return (
    <FormDialog
      label={t("addRate")}
      variant="primary"
      title={t("addRate")}
      endpoint="/api/v1/fx-rates"
      ns="settings.currencies"
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({ fromCurrency: f.get("from"), toCurrency: f.get("to"), rate: String(f.get("rate")).trim().replace(",", "."), date: f.get("date") })}
    >
      <div className="grid grid-cols-2 gap-3">
        <Select label={t("from")} name="from" defaultValue={currencies.find((c) => c !== base)}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {currencyLabel(c)}
            </option>
          ))}
        </Select>
        <Select label={t("to")} name="to" defaultValue={base}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {currencyLabel(c)}
            </option>
          ))}
        </Select>
      </div>
      <TextInput label={t("rate")} help={t("rateHelp", { from: t("from"), to: base })} name="rate" inputMode="decimal" required />
      <TextInput label={t("date")} name="date" type="date" defaultValue={today} required />
    </FormDialog>
  );
}
