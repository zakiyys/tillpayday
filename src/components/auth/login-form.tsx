"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { TextInput, useErrorText } from "@/components/form";
import { btn, Notice } from "@/components/ui";
import { authenticatePasskey, usePasskeySupported } from "./passkey";

export function LoginForm() {
  const t = useTranslations("auth");
  const errText = useErrorText("auth");
  const [error, setError] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = usePasskeySupported();

  async function passkey() {
    setError(null);
    try {
      await authenticatePasskey("login");
      window.location.assign("/");
    } catch (e) {
      if (!(e instanceof Error && e.name === "NotAllowedError")) setError(errText(e));
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { email: f.get("email"), password: f.get("password"), code: f.get("code") || undefined } });
      window.location.assign("/");
    } catch (err) {
      if (err instanceof ApiError && err.code === "totp_required") setNeedCode(true);
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {supported ? (
        <button type="button" onClick={passkey} className={btn.primary + " w-full"}>
          <KeyRound size={20} strokeWidth={1.75} aria-hidden />
          {t("loginPasskey")}
        </button>
      ) : null}
      <p className="text-center text-xs text-muted">{t("loginOr")}</p>
      <form onSubmit={submit} className="space-y-4">
        <TextInput label={t("email")} name="email" type="email" autoComplete="username webauthn" required />
        <TextInput label={t("passwordLabel")} name="password" type="password" autoComplete="current-password" required />
        {needCode ? <TextInput label={t("code")} help={t("codeHelp")} name="code" inputMode="text" autoComplete="one-time-code" autoFocus /> : null}
        <button type="submit" className={btn.secondary + " w-full"} disabled={busy}>
          {t("loginSubmit")}
        </button>
      </form>
    </div>
  );
}
