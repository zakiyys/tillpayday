"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { Select, TextInput, useErrorText } from "@/components/form";
import { MoneyInput } from "@/components/money-input";
import { btn, Card, Notice } from "@/components/ui";
import { currencyLabel } from "@/lib/currency";

const TZ = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Tokyo", "Europe/London", "Europe/Amsterdam", "America/New_York", "Australia/Sydney", "UTC"];

export function HouseholdForm(p: {
  name: string;
  baseCurrency: string;
  timezone: string;
  locale: string;
  payday: { day: number | "last"; shiftWeekend: string };
  unit: string;
  settings: { autoSaveBelow?: string | null; leftover?: string; netWorthView?: string };
  currencies: Array<{ code: string; exponent: number }>;
  baseLocked: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations("hh");
  const to = useTranslations("onboarding");
  const errText = useErrorText("hh");
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [auto, setAuto] = useState<string | null>(p.settings.autoSaveBelow ?? null);
  const exp = p.currencies.find((c) => c.code === p.baseCurrency)?.exponent ?? 0;
  const dis = !p.isOwner;
  return (
    <Card className="max-w-2xl">
      {msg ? (
        <div className="mb-3">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const day = String(f.get("day"));
          setMsg(null);
          try {
            await api("/api/v1/household", {
              method: "PATCH",
              body: {
                name: f.get("name"),
                ...(p.baseLocked ? {} : { baseCurrency: f.get("baseCurrency") }),
                timezone: f.get("timezone"),
                locale: f.get("locale"),
                paydayRule: { day: day === "last" ? "last" : Number(day), shiftWeekend: f.get("weekend") },
                allowanceUnit: f.get("unit"),
                settings: { autoSaveBelow: auto || null, leftover: f.get("leftover"), netWorthView: f.get("nwv") },
              },
            });
            setMsg({ tone: "info", text: t("saved") });
            router.refresh();
          } catch (err) {
            setMsg({ tone: "warn", text: errText(err) });
          }
        }}
      >
        <TextInput label={t("name")} name="name" defaultValue={p.name} required disabled={dis} />
        <Select label={t("baseCurrency")} name="baseCurrency" defaultValue={p.baseCurrency} disabled={dis || p.baseLocked} help={p.baseLocked ? t("baseLocked") : undefined}>
          {p.currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {currencyLabel(c.code)}
            </option>
          ))}
        </Select>
        <Select label={t("timezone")} name="timezone" defaultValue={p.timezone} disabled={dis}>
          {(TZ.includes(p.timezone) ? TZ : [p.timezone, ...TZ]).map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
        <Select label={t("language")} name="locale" defaultValue={p.locale} disabled={dis}>
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </Select>
        <Select label={t("payday")} name="day" defaultValue={String(p.payday.day)} disabled={dis}>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
          <option value="last">{t("paydayLast")}</option>
        </Select>
        <Select label={t("weekend")} name="weekend" defaultValue={p.payday.shiftWeekend} disabled={dis}>
          <option value="before">{to("weekendBefore")}</option>
          <option value="after">{to("weekendAfter")}</option>
          <option value="none">{to("weekendNone")}</option>
        </Select>
        <Select label={t("unit")} name="unit" defaultValue={p.unit} disabled={dis}>
          <option value="DAILY">{t("unitDaily")}</option>
          <option value="WEEKLY">{t("unitWeekly")}</option>
        </Select>
        <MoneyInput label={t("autoSave")} help={t("autoSaveHelp")} name="auto" exp={exp} currency={p.baseCurrency} defaultMinor={p.settings.autoSaveBelow ?? null} onMinor={setAuto} />
        <Select label={t("leftover")} name="leftover" defaultValue={p.settings.leftover ?? "OFFER_GOAL"} disabled={dis}>
          <option value="OFFER_GOAL">{t("leftoverOffer")}</option>
          <option value="CARRY">{t("leftoverCarry")}</option>
        </Select>
        <Select label={t("netWorthView")} name="nwv" defaultValue={p.settings.netWorthView ?? "OWN_PLUS_SHARED"} disabled={dis}>
          <option value="OWN_PLUS_SHARED">{t("netWorthOwn")}</option>
          <option value="ALL">{t("netWorthAll")}</option>
        </Select>
        {p.isOwner ? (
          <div className="md:col-span-2">
            <button type="submit" className={btn.primary}>
              {t("save")}
            </button>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
