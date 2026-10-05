"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { useReauth } from "@/components/auth/reauth";
import { Select, TextInput, useErrorText } from "@/components/form";
import { btn, Card, Notice, SectionTitle } from "@/components/ui";

/** Downloads go through fetch so the reauth prompt can run first; then the file is saved via a blob link. */
async function download(url: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw Object.assign(new Error(j.error ?? "internal"), { status: res.status, code: j.error ?? "internal" });
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "export";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await res.blob());
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DataSettings({ tables, defaultYear, isOwner }: { tables: string[]; defaultYear: number; isOwner: boolean }) {
  const t = useTranslations("data");
  const errText = useErrorText("data");
  const reauth = useReauth();
  const [msg, setMsg] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [table, setTable] = useState("transaction");
  const [year, setYear] = useState(defaultYear);
  const guarded = async (url: string) => {
    setMsg(null);
    try {
      await reauth(async () => {
        try {
          await download(url);
        } catch (e) {
          const err = e as { status?: number; code?: string };
          if (err.code === "reauth_required") {
            const { ApiError } = await import("@/lib/api-client");
            throw new ApiError(403, "reauth_required");
          }
          throw e;
        }
      });
    } catch (e) {
      setMsg({ tone: "warn", text: errText(e) });
    }
  };
  return (
    <div className="max-w-2xl space-y-2">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {isOwner ? (
        <Card className="space-y-4">
          <p className="text-sm text-muted">{t("exportNote")}</p>
          <button type="button" className={btn.primary} onClick={() => guarded("/api/v1/export?format=json")}>
            {t("exportJson")}
          </button>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Select label={t("table")} value={table} onChange={(e) => setTable(e.target.value)}>
                {tables.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>
            <button type="button" className={btn.secondary} onClick={() => guarded(`/api/v1/export?format=csv&table=${table}`)}>
              {t("exportCsv")}
            </button>
          </div>
        </Card>
      ) : null}
      <SectionTitle>{t("yearEnd")}</SectionTitle>
      <Card className="space-y-3">
        <p className="text-sm text-muted">{t("yearEndBody")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <TextInput label={t("year")} type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <button type="button" className={btn.secondary} onClick={() => guarded(`/api/v1/year-end?year=${year}`)}>
            {t("csv")}
          </button>
          <a href={`/reports/year-end?year=${year}`} className={btn.ghost}>
            {t("print")}
          </a>
        </div>
      </Card>
      {isOwner ? (
        <>
          <SectionTitle>{t("importTitle")}</SectionTitle>
          <Card>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const file = (new FormData(e.currentTarget).get("file") as File | null) ?? null;
                if (!file?.size) return;
                setMsg(null);
                try {
                  const body = JSON.parse(await file.text());
                  await reauth(() => api("/api/v1/import-data", { body }));
                  setMsg({ tone: "info", text: t("imported") });
                } catch (err) {
                  setMsg({ tone: "warn", text: errText(err) });
                }
              }}
            >
              <p className="text-sm text-muted">{t("importBody")}</p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-[550] text-ink">{t("importFile")}</span>
                <input name="file" type="file" accept="application/json,.json" className="block w-full text-sm text-ink file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-strong/50 file:bg-surface file:px-4 file:font-[600] file:text-ink" />
              </label>
              <button type="submit" className={btn.secondary}>
                {t("importRun")}
              </button>
            </form>
          </Card>
        </>
      ) : null}
      <SectionTitle>{t("backup")}</SectionTitle>
      <Card>
        <p className="text-sm text-ink">{t("backupBody")}</p>
      </Card>
    </div>
  );
}
