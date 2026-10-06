"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Select } from "@/components/form";
import { btn, Card, cx } from "@/components/ui";

const ACCENTS = [
  ["evergreen", "#0B5D4B"],
  ["slate", "#2F4F7A"],
  ["plum", "#6B3A5E"],
  ["graphite", "#2E3532"],
] as const;

/** Language, theme and accent are per device (cookies), so each member can choose their own. */
export function Appearance({ locale, theme, accent }: { locale: string; theme: string; accent: string }) {
  const t = useTranslations("look");
  const [l, setL] = useState(locale);
  const [th, setTh] = useState(theme);
  const [ac, setAc] = useState(accent);
  return (
    <Card className="max-w-xl space-y-4">
      <Select label={t("language")} value={l} onChange={(e) => setL(e.target.value)}>
        <option value="id">Bahasa Indonesia</option>
        <option value="en">English</option>
      </Select>
      <Select label={t("theme")} value={th} onChange={(e) => setTh(e.target.value)}>
        <option value="system">{t("system")}</option>
        <option value="light">{t("light")}</option>
        <option value="dark">{t("dark")}</option>
      </Select>
      <fieldset>
        <legend className="mb-1.5 text-sm font-[550] text-ink">{t("accent")}</legend>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map(([k, c]) => (
            <label key={k} className={cx("flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border px-3 text-sm", ac === k ? "border-accent bg-accent-soft font-[600] text-on-accent-soft" : "border-line text-ink")}>
              <input type="radio" name="accent" className="sr-only" checked={ac === k} onChange={() => setAc(k)} />
              <span aria-hidden className="size-4 rounded-full" style={{ background: c }} />
              {t(k)}
              {/* Selection shown by a check mark, not colour alone; the native radio carries the checked state for AT. */}
              {ac === k ? <Check size={16} strokeWidth={2} aria-hidden className="shrink-0" /> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        className={btn.primary}
        onClick={() => {
          const y = "path=/; max-age=31536000; samesite=lax";
          document.cookie = `locale=${l}; ${y}`;
          document.cookie = `theme=${th}; ${y}`;
          document.cookie = `accent=${ac === "evergreen" ? "" : ac}; ${y}`;
          window.location.reload();
        }}
      >
        {t("save")}
      </button>
    </Card>
  );
}
