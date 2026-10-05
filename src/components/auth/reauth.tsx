"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api-client";
import { TextInput, useErrorText } from "@/components/form";
import { btn, Notice } from "@/components/ui";
import { authenticatePasskey, usePasskeySupported } from "./passkey";

type Run = <T>(fn: () => Promise<T>) => Promise<T>;
const Ctx = createContext<Run>((fn) => fn());

/**
 * Wraps sensitive calls: when the server answers reauth_required, asks for passkey or password,
 * then retries the call once (SPEC 14, aksi sensitif).
 */
export function ReauthProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);
  const run = useCallback<Run>(async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "reauth_required")) throw e;
      await new Promise<void>((resolve, reject) => setPending({ resolve, reject }));
      return fn();
    }
  }, []);
  return (
    <Ctx.Provider value={run}>
      {children}
      {pending ? (
        <ReauthDialog
          onDone={() => {
            pending.resolve();
            setPending(null);
          }}
          onCancel={() => {
            pending.reject(new ApiError(403, "reauth_required"));
            setPending(null);
          }}
        />
      ) : null}
    </Ctx.Provider>
  );
}

export const useReauth = () => useContext(Ctx);

function ReauthDialog({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const errText = useErrorText("auth");
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [needCode, setNeedCode] = useState(false);
  const supported = usePasskeySupported();
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function withPasskey() {
    setError(null);
    try {
      await authenticatePasskey("reauth");
      onDone();
    } catch (e) {
      if (!(e instanceof Error && e.name === "NotAllowedError")) setError(errText(e));
    }
  }
  async function withPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    try {
      await api("/api/auth/reauth", { body: { password: f.get("password"), code: f.get("code") || undefined } });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "totp_required") setNeedCode(true);
      setError(errText(err));
    }
  }
  return (
    <dialog ref={ref} onCancel={onCancel} aria-labelledby="reauth-title" className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-5 text-ink shadow-float backdrop:bg-black/40">
      <h2 id="reauth-title" className="text-lg font-[650]">{t("reauthTitle")}</h2>
      <p className="mt-1 text-sm text-muted">{t("reauthBody")}</p>
      <div className="mt-4 space-y-4">
        {error ? <Notice tone="warn">{error}</Notice> : null}
        {supported ? (
          <button type="button" className={btn.primary + " w-full"} onClick={withPasskey}>
            {t("reauthPasskey")}
          </button>
        ) : null}
        <form onSubmit={withPassword} className="space-y-3">
          <TextInput label={t("passwordLabel")} name="password" type="password" autoComplete="current-password" required />
          {needCode ? <TextInput label={t("code")} name="code" autoComplete="one-time-code" /> : null}
          <div className="flex gap-2">
            <button type="button" className={btn.ghost + " flex-1"} onClick={onCancel}>
              {tc("cancel")}
            </button>
            <button type="submit" className={btn.secondary + " flex-1"}>
              {t("reauthPassword")}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
