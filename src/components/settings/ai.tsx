"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { TextInput, useErrorText } from "@/components/form";
import { btn, Card, Notice, SectionTitle } from "@/components/ui";
import { useReauth } from "@/components/auth/reauth";

export interface AiView {
  endpoint: string;
  model: string;
  visionModel: string | null;
  keyHint: string | null;
  fallbackEndpoint: string | null;
  fallbackModel: string | null;
  fallbackKeyHint: string | null;
  capabilities: { ok?: boolean; structured?: boolean; vision?: boolean; testedAt?: string };
}

export function AiSettings({ config, isOwner, onSaved }: { config: AiView | null; isOwner: boolean; onSaved?: () => void }) {
  const t = useTranslations("ai");
  const errText = useErrorText("ai");
  const router = useRouter();
  const reauth = useReauth();
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const caps = config?.capabilities ?? {};
  const yn = (v?: boolean) => (v ? t("yes") : t("no"));

  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-sm text-muted">{t("intro")}</p>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const key = String(f.get("apiKey") ?? "");
            const fkey = String(f.get("fallbackKey") ?? "");
            setMsg(null);
            try {
              await reauth(() =>
                api("/api/v1/ai-config", {
                  method: "PUT",
                  body: {
                    endpoint: f.get("endpoint"),
                    model: f.get("model"),
                    visionModel: f.get("visionModel") || null,
                    ...(key ? { apiKey: key } : {}),
                    fallbackEndpoint: f.get("fallbackEndpoint") || null,
                    fallbackModel: f.get("fallbackModel") || null,
                    ...(fkey ? { fallbackKey: fkey } : {}),
                  },
                }),
              );
              setMsg({ tone: "info", text: t("saved") });
              (e.target as HTMLFormElement).querySelectorAll<HTMLInputElement>("input[type=password]").forEach((i) => (i.value = ""));
              router.refresh();
              onSaved?.();
            } catch (err) {
              setMsg({ tone: "warn", text: errText(err) });
            }
          }}
        >
          <TextInput label={t("endpoint")} help={t("endpointHelp")} name="endpoint" type="url" defaultValue={config?.endpoint ?? ""} required disabled={!isOwner} />
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label={t("model")} name="model" defaultValue={config?.model ?? ""} required disabled={!isOwner} />
            <TextInput label={t("visionModel")} help={t("visionModelHelp")} name="visionModel" defaultValue={config?.visionModel ?? ""} disabled={!isOwner} />
          </div>
          <TextInput label={t("apiKey")} help={config?.keyHint ? `${t("keyStored", { hint: config.keyHint })} ${t("apiKeyHelp")}` : undefined} name="apiKey" type="password" autoComplete="off" disabled={!isOwner} />
          <details className="rounded-btn border border-line p-3">
            <summary className="min-h-11 cursor-pointer content-center text-sm font-[600] text-ink">{t("fallback")}</summary>
            <p className="mb-3 text-xs text-muted">{t("fallbackHelp")}</p>
            <div className="space-y-4">
              <TextInput label={t("fbEndpoint")} name="fallbackEndpoint" type="url" defaultValue={config?.fallbackEndpoint ?? ""} disabled={!isOwner} />
              <TextInput label={t("fbModel")} name="fallbackModel" defaultValue={config?.fallbackModel ?? ""} disabled={!isOwner} />
              <TextInput label={t("fbKey")} help={config?.fallbackKeyHint ? t("keyStored", { hint: config.fallbackKeyHint }) : undefined} name="fallbackKey" type="password" autoComplete="off" disabled={!isOwner} />
            </div>
          </details>
          {isOwner ? (
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btn.primary}>
                {t("save")}
              </button>
              {config ? (
                <button
                  type="button"
                  className={btn.danger}
                  onClick={async () => {
                    try {
                      await reauth(() => api("/api/v1/ai-config", { method: "DELETE" }));
                      router.refresh();
                    } catch (err) {
                      setMsg({ tone: "warn", text: errText(err) });
                    }
                  }}
                >
                  {t("remove")}
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </Card>

      <SectionTitle
        action={
          config && isOwner ? (
            <button
              type="button"
              className={btn.secondary}
              disabled={testing}
              onClick={async () => {
                setTesting(true);
                setMsg(null);
                try {
                  await api("/api/v1/ai-config/test", { body: {} });
                  router.refresh();
                } catch (err) {
                  setMsg({ tone: "warn", text: errText(err) });
                } finally {
                  setTesting(false);
                }
              }}
            >
              {testing ? t("testing") : t("test")}
            </button>
          ) : null
        }
      >
        {t("status")}
      </SectionTitle>
      <Card>
        {caps.testedAt ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t("status")}</dt>
            <dd className={caps.ok ? "font-[600] text-accent" : "font-[600] text-warning"}>{caps.ok ? t("ok") : t("failed")}</dd>
            <dt className="text-muted">{t("structured")}</dt>
            <dd className="text-ink">{yn(caps.structured)}</dd>
            <dt className="text-muted">{t("vision")}</dt>
            <dd className="text-ink">{yn(caps.vision)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-muted">{t("never")}</p>
        )}
      </Card>

      <SectionTitle>{t("sent")}</SectionTitle>
      <Card>
        <p className="text-sm text-ink">{t("sentBody")}</p>
      </Card>
    </div>
  );
}
