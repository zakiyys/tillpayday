"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { TextInput, useErrorText } from "@/components/form";
import { btn, Card, Chip, Notice, SectionTitle } from "@/components/ui";
import { useReauth } from "@/components/auth/reauth";

export function Members({ members, invites, me, isOwner }: { members: Array<{ id: string; name: string; email: string; role: string }>; invites: Array<{ id: string; email: string }>; me: string; isOwner: boolean }) {
  const t = useTranslations("hh");
  const errText = useErrorText("hh");
  const router = useRouter();
  const reauth = useReauth();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await reauth(fn);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    }
  };
  return (
    <div className="mt-2 max-w-2xl space-y-2">
      <SectionTitle>{t("members")}</SectionTitle>
      <p className="text-sm text-muted">{t("privacy")}</p>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Card flush>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-[600] text-ink">
                  {m.name} {m.id === me ? <span className="text-xs font-[450] text-muted">({t("you")})</span> : null}
                </p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Chip active={m.role === "OWNER"}>{m.role === "OWNER" ? t("owner") : t("member")}</Chip>
                {isOwner && m.role !== "OWNER" ? (
                  <button type="button" className={btn.ghost} aria-label={t("removeLabel", { name: m.name })} onClick={() => run(() => api(`/api/v1/members/${m.id}`, { method: "DELETE" }))}>
                    {t("remove")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {isOwner ? (
        <>
          <SectionTitle>{t("invite")}</SectionTitle>
          <Card className="space-y-3">
            <form
              className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const email = String(new FormData(e.currentTarget).get("email"));
                void run(async () => setLink((await api<{ link: string }>("/api/v1/invites", { body: { email } })).link));
              }}
            >
              <TextInput label={t("inviteEmail")} name="email" type="email" required />
              <button type="submit" className={btn.primary}>
                {t("inviteSend")}
              </button>
            </form>
            {link ? (
              <div className="space-y-2">
                <Notice>{t("inviteLink")}</Notice>
                <p className="break-all rounded-btn bg-surface-2 px-3 py-2 font-mono text-sm text-ink" data-testid="invite-link">
                  {link}
                </p>
              </div>
            ) : null}
            {invites.length ? (
              <div>
                <p className="mb-1 text-sm font-[600] text-ink">{t("pending")}</p>
                <ul className="divide-y divide-line">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                      <span className="truncate text-ink">{i.email}</span>
                      <button type="button" className={btn.ghost} onClick={() => run(() => api(`/api/v1/invites/${i.id}`, { method: "DELETE" }))}>
                        {t("revoke")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
