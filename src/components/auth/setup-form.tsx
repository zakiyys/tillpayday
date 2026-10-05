"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { TextInput, Select, useErrorText } from "@/components/form";
import { btn, Notice } from "@/components/ui";
import { usePasskeySupported, registerPasskey } from "./passkey";

export function SetupForm() {
  const t = useTranslations("auth");
  const errText = useErrorText("auth");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [step, setStep] = useState<"form" | "codes" | "passkey">("form");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const locale = String(f.get("locale"));
      document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
      const r = await api<{ recoveryCodes: string[] }>("/api/auth/setup", {
        body: { setupToken: f.get("setupToken"), name: f.get("name"), email: f.get("email"), password: f.get("password") || undefined, locale },
      });
      setCodes(r.recoveryCodes);
      setStep("codes");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "codes" && codes) {
    return (
      <div className="mt-6 space-y-4">
        <h2 className="text-lg font-[650] text-ink">{t("recoveryTitle")}</h2>
        <p className="text-sm text-muted">{t("recoveryBody")}</p>
        <ul className="num grid grid-cols-2 gap-2 rounded-card-sm border border-line bg-surface p-4 font-mono text-sm text-ink" aria-label={t("recoveryTitle")}>
          {codes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button type="button" className={btn.primary + " w-full"} onClick={() => setStep("passkey")}>
          {t("recoveryDone")}
        </button>
      </div>
    );
  }

  if (step === "passkey") return <PasskeyStep next="/onboarding" />;

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <TextInput label={t("setupToken")} help={t("setupTokenHelp")} name="setupToken" type="password" autoComplete="off" required />
      <TextInput label={t("name")} name="name" autoComplete="name" required maxLength={80} />
      <TextInput label={t("email")} name="email" type="email" autoComplete="email" required />
      <TextInput label={t("passwordLabel")} help={t("passwordHelp")} name="password" type="password" autoComplete="new-password" minLength={12} />
      <Select label={t("language")} name="locale" defaultValue="id">
        <option value="id">Bahasa Indonesia</option>
        <option value="en">English</option>
      </Select>
      <button type="submit" className={btn.primary + " w-full"} disabled={busy}>
        {t("createOwner")}
      </button>
    </form>
  );
}

export function PasskeyStep({ next }: { next: string }) {
  const t = useTranslations("auth");
  const errText = useErrorText("auth");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supported = usePasskeySupported();
  async function add() {
    setBusy(true);
    setError(null);
    try {
      await registerPasskey();
      window.location.assign(next);
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? null : errText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-lg font-[650] text-ink">{t("passkeyTitle")}</h2>
      <p className="text-sm text-muted">{t("passkeyBody")}</p>
      {!supported ? <Notice>{t("passkeyUnsupported")}</Notice> : null}
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <div className="flex gap-2">
        {supported ? (
          <button type="button" className={btn.primary + " flex-1"} onClick={add} disabled={busy}>
            {t("passkeyAdd")}
          </button>
        ) : null}
        <a href={next} className={btn.secondary + " flex-1"}>
          {t("passkeySkip")}
        </a>
      </div>
    </div>
  );
}
