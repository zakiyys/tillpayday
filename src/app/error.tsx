"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-xl font-[650] text-ink">{t("errorTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("errorBody")}</p>
      <button type="button" onClick={reset} className="press mt-6 inline-flex min-h-11 items-center rounded-btn bg-accent px-4 text-sm font-[600] text-on-accent">
        {t("retry")}
      </button>
    </main>
  );
}
