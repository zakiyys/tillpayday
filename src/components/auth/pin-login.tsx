"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api-client";
import { useErrorText } from "@/components/form";
import { LoginForm } from "./login-form";
import { PinPad } from "./pin-pad";

/** Login on a trusted device: the PIN pad first, the full sign-in one tap away. */
export function PinLogin({ name }: { name: string }) {
  const t = useTranslations("pin");
  const errText = useErrorText("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);

  if (full) return <LoginForm />;

  async function submit(v: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/pin", { body: { pin: v } });
      window.location.assign("/");
    } catch (e) {
      setPin("");
      if (e instanceof ApiError && e.code === "pin_wrong") setError(t("wrong", { left: (e.details as { left: number }).left }));
      else if (e instanceof ApiError && (e.code === "pin_locked" || e.code === "pin_device_unknown")) {
        setError(errText(e));
        setFull(true);
      } else setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-6">
      <p className="text-muted">{t("welcome", { name: name.split(" ")[0] ?? name })}</p>
      <PinPad value={pin} onChange={setPin} onComplete={submit} label={t("enter")} error={error} disabled={busy} />
      <div className="flex flex-col items-center gap-1 text-sm">
        <button type="button" className="min-h-11 font-[600] text-accent" onClick={() => setFull(true)}>
          {t("usePassword")}
        </button>
        <button
          type="button"
          className="min-h-11 text-muted underline underline-offset-4"
          onClick={async () => {
            await api("/api/auth/pin/forget", { body: {} }).catch(() => undefined);
            setFull(true);
          }}
        >
          {t("notYou", { name: name.split(" ")[0] ?? name })}
        </button>
      </div>
    </div>
  );
}
