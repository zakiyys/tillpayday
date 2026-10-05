"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { btn, Card, Notice, SectionTitle } from "@/components/ui";

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

export function NotificationSettings({ kinds, off: initialOff, recapDay, recapHour, inbox }: { kinds: string[]; off: string[]; recapDay: number; recapHour: number; inbox: Array<{ id: string; title: string; when: string; read: boolean }> }) {
  const t = useTranslations("notifications");
  const tb = useTranslations("bills");
  const router = useRouter();
  const [off, setOff] = useState<string[]>(initialOff);
  const [day, setDay] = useState(recapDay);
  const [hour, setHour] = useState(recapHour);
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [push, setPush] = useState<"unknown" | "on" | "off" | "unsupported" | "denied">("unknown");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after mount
      setPush("unsupported");
      return;
    }
    void navigator.serviceWorker.ready.then(async (r) => setPush((await r.pushManager.getSubscription()) ? "on" : Notification.permission === "denied" ? "denied" : "off"));
  }, []);

  const togglePush = async () => {
    setMsg(null);
    const reg = await navigator.serviceWorker.ready;
    if (push === "on") {
      const s = await reg.pushManager.getSubscription();
      if (s) {
        await api("/api/v1/push", { method: "DELETE", body: { endpoint: s.endpoint } });
        await s.unsubscribe();
      }
      setPush("off");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPush("denied");
      return;
    }
    const { publicKey } = await api<{ publicKey: string | null }>("/api/v1/push");
    if (!publicKey) return;
    const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    await api("/api/v1/push", { body: s.toJSON() });
    setPush("on");
  };

  const weekdays = tb.raw("weekdays") as string[];
  return (
    <div className="max-w-2xl space-y-2">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <SectionTitle>{t("push")}</SectionTitle>
      <Card className="space-y-3">
        {push === "unsupported" ? <p className="text-sm text-muted">{t("pushUnsupported")}</p> : null}
        {push === "denied" ? <Notice tone="warn">{t("pushDenied")}</Notice> : null}
        {push === "on" ? <p className="text-sm text-ink">{t("pushEnabled")}</p> : null}
        {push === "on" || push === "off" ? (
          <button type="button" className={push === "on" ? btn.secondary : btn.primary} onClick={togglePush}>
            {push === "on" ? t("pushOff") : t("pushOn")}
          </button>
        ) : null}
      </Card>
      <SectionTitle>{t("kinds")}</SectionTitle>
      <Card>
        <fieldset>
          <legend className="sr-only">{t("kinds")}</legend>
          <ul className="space-y-1">
            {kinds.map((k) => (
              <li key={k}>
                <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
                  <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={!off.includes(k)} onChange={(e) => setOff((o) => (e.target.checked ? o.filter((x) => x !== k) : [...o, k]))} />
                  {t(`kind.${k}`)}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
          <p className="col-span-2 text-sm font-[600] text-ink">{t("recapWhen")}</p>
          <label className="text-sm">
            <span className="mb-1 block text-ink">{t("recapDay")}</span>
            <select className="min-h-11 w-full rounded-btn border border-line-strong/50 bg-surface px-2 text-ink" value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {weekdays.map((w, i) => (
                <option key={w} value={i}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink">{t("recapHour")}</span>
            <select className="min-h-11 w-full rounded-btn border border-line-strong/50 bg-surface px-2 text-ink" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className={btn.primary + " mt-4"}
          onClick={async () => {
            await api("/api/v1/notifications", { method: "PATCH", body: { off, recapDay: day, recapHour: hour } });
            setMsg({ tone: "info", text: t("saved") });
          }}
        >
          {t("save")}
        </button>
      </Card>
      <SectionTitle
        action={
          inbox.some((i) => !i.read) ? (
            <button
              type="button"
              className={btn.ghost}
              onClick={async () => {
                await api("/api/v1/notifications", { method: "PATCH", body: { readAll: true } });
                router.refresh();
              }}
            >
              {t("markRead")}
            </button>
          ) : null
        }
      >
        {t("inbox")}
      </SectionTitle>
      <Card flush>
        {inbox.length ? (
          <ul className="divide-y divide-line">
            {inbox.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className={n.read ? "text-muted" : "font-[600] text-ink"}>{n.title}</span>
                <span className="shrink-0 text-xs text-muted">{n.when}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">{t("inboxEmpty")}</p>
        )}
      </Card>
    </div>
  );
}
