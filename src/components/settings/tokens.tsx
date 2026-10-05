"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { dateTime } from "@/lib/format";
import { Select, TextInput, useErrorText } from "@/components/form";
import { btn, Card, Notice } from "@/components/ui";
import { useReauth } from "@/components/auth/reauth";

export function Tokens({ tokens, intl, timeZone }: { tokens: Array<{ id: string; label: string; scope: string; lastUsedAt: string | null }>; intl: string; timeZone: string }) {
  const t = useTranslations("tokens");
  const tc = useTranslations("common");
  const errText = useErrorText();
  const router = useRouter();
  const reauth = useReauth();
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {shown ? (
        <Card className="space-y-2">
          <Notice>{t("shown")}</Notice>
          <p className="break-all rounded-btn bg-surface-2 px-3 py-2 font-mono text-sm text-ink" data-testid="new-token">
            {shown}
          </p>
        </Card>
      ) : null}
      <Card>
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError(null);
            try {
              const r = await reauth(() => api<{ token: string }>("/api/v1/tokens", { body: { label: f.get("label"), scope: f.get("scope") } }));
              setShown(r.token);
              router.refresh();
            } catch (err) {
              setError(errText(err));
            }
          }}
        >
          <TextInput label={t("label")} name="label" required maxLength={60} />
          <Select label={t("scope")} name="scope">
            <option value="INGEST">{t("INGEST")}</option>
            <option value="SUMMARY_READ">{t("SUMMARY_READ")}</option>
          </Select>
          <button type="submit" className={btn.primary}>
            {t("create")}
          </button>
        </form>
      </Card>
      <Card flush>
        {tokens.length ? (
          <ul className="divide-y divide-line">
            {tokens.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-[600] text-ink">{k.label}</p>
                  <p className="text-xs text-muted">
                    {t(k.scope as "INGEST")} · {k.lastUsedAt ? t("lastUsed", { when: dateTime(k.lastUsedAt, intl, timeZone) }) : t("neverUsed")}
                  </p>
                </div>
                <button
                  type="button"
                  className={btn.ghost}
                  aria-label={t("revokeLabel", { label: k.label })}
                  onClick={async () => {
                    await api(`/api/v1/tokens/${k.id}`, { method: "DELETE" });
                    router.refresh();
                  }}
                >
                  {t("revoke")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">{t("none")}</p>
        )}
      </Card>
      <span className="sr-only">{tc("loading")}</span>
    </div>
  );
}
