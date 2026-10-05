"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { TextInput, useErrorText } from "@/components/form";
import { btn, Notice } from "@/components/ui";
import { PasskeyStep } from "./setup-form";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("auth");
  const errText = useErrorText("auth");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <PasskeyStep next="/" />;
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await api("/api/auth/invite", { body: { token, name: f.get("name"), password: f.get("password") } });
          setDone(true);
        } catch (err) {
          setError(errText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <TextInput label={t("email")} value={email} readOnly />
      <TextInput label={t("name")} name="name" autoComplete="name" required maxLength={80} />
      <TextInput label={t("passwordLabel")} help={t("passwordHelp")} name="password" type="password" autoComplete="new-password" minLength={12} required />
      <button type="submit" className={btn.primary + " w-full"} disabled={busy}>
        {t("inviteAccept")}
      </button>
    </form>
  );
}
