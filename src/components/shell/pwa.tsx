"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { flushOffline, pendingCount } from "@/lib/offline-queue";

/** Registers the service worker and flushes the offline queue when online (SPEC 13). */
export function PwaClient() {
  const t = useTranslations("pwa");
  const [sent, setSent] = useState(0);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    const flush = async () => {
      if (!navigator.onLine || !(await pendingCount().catch(() => 0))) return;
      const n = await flushOffline().catch(() => 0);
      if (n) setSent(n);
    };
    void flush();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "flush-offline") void flush();
    };
    window.addEventListener("online", flush);
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("online", flush);
      navigator.serviceWorker.removeEventListener("message", onMsg);
    };
  }, []);
  if (!sent) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-btn border border-line bg-surface px-3 py-2 text-sm text-ink shadow-float">
      {t("flushed", { count: sent })}{" "}
      <a href="/record" className="font-[650] text-accent underline underline-offset-4">
        {t("review")}
      </a>
    </div>
  );
}
