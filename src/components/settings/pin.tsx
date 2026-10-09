"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LockKeyhole, Smartphone, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateTime } from "@/lib/format";
import { Select, useErrorText } from "@/components/form";
import { btn, Card, Chip, Notice, SectionTitle } from "@/components/ui";
import { useReauth } from "@/components/auth/reauth";
import { PinPad } from "@/components/auth/pin-pad";
import { pinProblem } from "@/lib/pin";

interface Status {
  hasPin: boolean;
  lockAfterMinutes: number | null;
  devices: Array<{ id: string; label: string; lastUsedAt: string; current: boolean }>;
}

const LOCKS = [15, 60, 480, 1440] as const;

/** PIN quick unlock: set or change the PIN (twice, after re-authentication), trusted devices, auto-lock. */
export function PinSettings({ intl, timeZone }: { intl: string; timeZone: string }) {
  const t = useTranslations("pin");
  const errText = useErrorText("pin");
  const reauth = useReauth();
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [step, setStep] = useState<null | "first" | "again">(null);
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [padError, setPadError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    api<Status>("/api/auth/pin/settings").then(setS).catch(() => undefined);
  }, []);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (step && !d.open) d.showModal();
    if (!step && d.open) d.close();
  }, [step]);

  const run = async (fn: () => Promise<Status>, ok?: string) => {
    setMsg(null);
    try {
      setS(await reauth(fn));
      if (ok) setMsg({ tone: "info", text: ok });
    } catch (e) {
      setMsg({ tone: "warn", text: errText(e) });
    }
  };

  const onFirst = (v: string) => {
    const problem = pinProblem(v);
    if (problem) {
      setPin("");
      setPadError(t(problem));
      return;
    }
    setFirst(v);
    setPin("");
    setPadError(null);
    setStep("again");
  };
  const onAgain = async (v: string) => {
    if (v !== first) {
      setPin("");
      setFirst("");
      setPadError(t("mismatch"));
      setStep("first");
      return;
    }
    setStep(null);
    setPin("");
    await run(() => api<Status>("/api/auth/pin/settings", { body: { pin: v } }), t("saved"));
  };
  const here = s?.devices.find((d) => d.current);

  return (
    <>
      <SectionTitle>{t("title")}</SectionTitle>
      <Card className="space-y-4">
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-btn bg-accent-soft text-on-accent-soft">
            <LockKeyhole size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-[600] text-ink">{s?.hasPin ? t("on") : t("off")}</p>
            <p className="text-sm text-muted">{t("body")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={() => { setPadError(null); setPin(""); setStep("first"); }} disabled={!s}>
            {s?.hasPin ? (here ? t("change") : t("useHere")) : t("create")}
          </button>
          {s?.hasPin ? (
            <button type="button" className={btn.danger} onClick={() => run(() => api<Status>("/api/auth/pin/settings", { method: "DELETE" }), t("removed"))}>
              {t("remove")}
            </button>
          ) : null}
        </div>
        {s?.hasPin ? (
          <>
            <Select
              label={t("lock")}
              help={t("lockHelp")}
              value={s.lockAfterMinutes ?? ""}
              onChange={(e) => run(() => api<Status>("/api/auth/pin/settings", { method: "PATCH", body: { lockAfterMinutes: e.target.value ? Number(e.target.value) : null } }))}
            >
              <option value="">{t("lockNever")}</option>
              {LOCKS.map((m) => (
                <option key={m} value={m}>
                  {t(`lock_${m}`)}
                </option>
              ))}
            </Select>
            <div>
              <p className="mb-1 text-sm font-[550] text-ink">{t("devices")}</p>
              {s.devices.length ? (
                <ul className="divide-y divide-line rounded-btn border border-line">
                  {s.devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Smartphone size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-[550] text-ink">
                          {d.label} {d.current ? <Chip className="ml-1 align-middle">{t("thisDevice")}</Chip> : null}
                        </p>
                        <p className="text-xs text-muted">{t("lastUsed", { when: dateTime(d.lastUsedAt, intl, timeZone) })}</p>
                      </div>
                      <button
                        type="button"
                        className="grid size-11 place-items-center rounded-btn text-warning hover:bg-warning-soft"
                        aria-label={t("forget", { device: d.label })}
                        onClick={() => run(() => api<Status>("/api/auth/pin/settings", { method: "PATCH", body: { revokeDevice: d.id } }))}
                      >
                        <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{t("noDevices")}</p>
              )}
            </div>
          </>
        ) : null}
      </Card>
      <dialog
        ref={dialog}
        onClose={() => setStep(null)}
        aria-label={t("title")}
        className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-5 text-ink shadow-float backdrop:bg-black/40"
      >
        {step ? (
          <PinPad
            key={step}
            value={pin}
            onChange={setPin}
            onComplete={step === "first" ? onFirst : onAgain}
            label={step === "first" ? t("chooseNew") : t("confirmNew")}
            error={padError}
          />
        ) : null}
        <p className="mt-4 text-center text-xs text-muted">{t("rules")}</p>
        <button type="button" className={btn.ghost + " mt-2 w-full"} onClick={() => setStep(null)}>
          {t("cancel")}
        </button>
      </dialog>
    </>
  );
}
