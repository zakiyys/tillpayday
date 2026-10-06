"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Smartphone, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateTime } from "@/lib/format";
import { TextInput, useErrorText } from "@/components/form";
import { btn, Card, Notice, SectionTitle } from "@/components/ui";
import { usePasskeySupported, registerPasskey } from "@/components/auth/passkey";
import { useReauth } from "@/components/auth/reauth";

interface Props {
  intl: string;
  timeZone: string;
  sessions: Array<{ id: string; device: string; lastSeen: string; current: boolean }>;
  passkeys: Array<{ id: string; label: string; lastUsed: string | null }>;
  hasPassword: boolean;
  totpOn: boolean;
}

export function SecuritySettings(p: Props) {
  const t = useTranslations("security");
  const errText = useErrorText("security");
  const router = useRouter();
  const reauth = useReauth();
  const supported = usePasskeySupported();
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [totp, setTotp] = useState<{ uri: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null);
    try {
      await reauth(fn);
      if (ok) setMsg({ tone: "info", text: ok });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "warn", text: errText(e) });
    }
  };

  return (
    <div className="max-w-2xl space-y-2">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}

      <SectionTitle
        action={
          supported ? (
            <button type="button" className={btn.secondary} onClick={() => act(() => registerPasskey())}>
              <KeyRound size={18} strokeWidth={1.75} aria-hidden />
              {t("addPasskey")}
            </button>
          ) : null
        }
      >
        {t("passkeys")}
      </SectionTitle>
      <Card flush>
        {p.passkeys.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t("noPasskeys")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {p.passkeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-[550] text-ink">{k.label}</p>
                  <p className="text-xs text-muted">{k.lastUsed ? t("lastUsed", { when: dateTime(k.lastUsed, p.intl, p.timeZone) }) : t("neverUsed")}</p>
                </div>
                <button
                  type="button"
                  className="grid size-11 place-items-center rounded-btn border border-warning/60 text-warning hover:bg-warning-soft"
                  aria-label={t("removePasskey", { label: k.label })}
                  onClick={() => act(() => api("/api/auth/sessions", { method: "DELETE", body: { id: k.id, kind: "passkey" } }))}
                >
                  <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>{t("sessions")}</SectionTitle>
      <Card flush>
        <ul className="divide-y divide-line">
          {p.sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Smartphone size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="truncate font-[550] text-ink">
                    {s.device}
                    {s.current ? <span className="ml-2 text-xs font-[600] text-accent">{t("thisDevice")}</span> : null}
                  </p>
                  <p className="text-xs text-muted">{t("lastSeen", { when: dateTime(s.lastSeen, p.intl, p.timeZone) })}</p>
                </div>
              </div>
              {!s.current ? (
                <button
                  type="button"
                  className={btn.danger}
                  aria-label={t("revokeLabel", { device: s.device })}
                  onClick={() => act(() => api("/api/auth/sessions", { method: "DELETE", body: { id: s.id } }))}
                >
                  {t("revoke")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>{t("backup")}</SectionTitle>
      <Card className="space-y-6">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const form = e.currentTarget;
            void act(() => api("/api/auth/password", { body: { password: f.get("password") } }), t("passwordSaved")).then(() => form.reset());
          }}
        >
          <h3 className="font-[600] text-ink">{t("password")}</h3>
          <TextInput label={t("newPassword")} name="password" type="password" autoComplete="new-password" minLength={12} required />
          <button type="submit" className={btn.secondary}>
            {t("passwordSet")}
          </button>
        </form>

        <div className="space-y-3 border-t border-line pt-5">
          <h3 className="font-[600] text-ink">{t("totp")}</h3>
          <p className="text-sm text-muted">{p.totpOn ? t("totpOn") : t("totpOff")}</p>
          {totp ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const code = String(new FormData(e.currentTarget).get("code"));
                void act(async () => {
                  await api("/api/auth/totp", { body: { code } });
                  setTotp(null);
                });
              }}
            >
              <p className="text-sm text-ink">{t("totpSecret")}</p>
              <p className="num break-all rounded-btn bg-surface-2 px-3 py-2 font-mono text-sm text-ink">{totp.secret}</p>
              <a href={totp.uri} className="text-sm font-[600] text-accent underline underline-offset-4">
                {t("totpLink")}
              </a>
              <TextInput label={t("totpCode")} name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required />
              <button type="submit" className={btn.primary}>
                {t("totpConfirm")}
              </button>
            </form>
          ) : p.totpOn ? (
            <button type="button" className={btn.danger} onClick={() => act(() => api("/api/auth/totp", { method: "DELETE", body: {} }))}>
              {t("totpDisable")}
            </button>
          ) : (
            <button type="button" className={btn.secondary} onClick={() => act(async () => setTotp(await api("/api/auth/totp")))}>
              {t("totpEnable")}
            </button>
          )}
        </div>

        <div className="space-y-3 border-t border-line pt-5">
          <h3 className="font-[600] text-ink">{t("recovery")}</h3>
          <p className="text-sm text-muted">{t("recoveryBody")}</p>
          {codes ? (
            <>
              <Notice>{t("recoveryShown")}</Notice>
              <ul className="num grid grid-cols-2 gap-2 rounded-btn bg-surface-2 p-3 font-mono text-sm text-ink">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" className={btn.danger} onClick={() => act(async () => setCodes((await api<{ codes: string[] }>("/api/auth/recovery", { body: {} })).codes))}>
            {t("recoveryNew")}
          </button>
        </div>
      </Card>
    </div>
  );
}
