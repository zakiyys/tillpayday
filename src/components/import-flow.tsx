"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { CsvMapping } from "@/domain/statement";
import type { ReviewRow } from "@/server/import/statements";
import { Select, useErrorText } from "./form";
import { btn, Card, Chip, Notice, cx } from "./ui";

interface Opts {
  accounts: Array<{ id: string; name: string; currency: string; last4: string | null }>;
  categories: Array<{ id: string; name: string; kind: string }>;
  currencies: Array<{ code: string; exponent: number }>;
}

export function ImportFlow({ opts, intl, defaultAccountId, resumeBatch }: { opts: Opts; intl: string; defaultAccountId?: string; resumeBatch?: { id: string; accountId: string; rows: ReviewRow[] } | null }) {
  const t = useTranslations("import");
  const ttx = useTranslations("tx");
  const errText = useErrorText("import");
  const router = useRouter();
  const [accountId, setAccountId] = useState(resumeBatch?.accountId ?? defaultAccountId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ id: string; accountId: string; rows: ReviewRow[] } | null>(resumeBatch ?? null);
  const [mapping, setMapping] = useState<CsvMapping | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ matched: number; created: number; check: { kind: string; diff: string } | null } | null>(null);
  const acc = opts.accounts.find((a) => a.id === (batch?.accountId ?? accountId));
  const exp = opts.currencies.find((c) => c.code === acc?.currency)?.exponent ?? 0;
  const fmt = (v: string) => money(BigInt(v), acc?.currency ?? "IDR", intl, { exp });

  const read = async (m?: CsvMapping | null) => {
    setBusy(true);
    setError(null);
    try {
      let attId = attachmentId;
      if (!attId) {
        if (!file) throw new Error("file_missing");
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/v1/attachments", { method: "POST", body: fd, credentials: "same-origin" });
        const data = await res.json();
        if (!res.ok) throw Object.assign(new Error(data.error), { code: data.error });
        attId = data.attachment.id as string;
        setAttachmentId(attId);
      }
      if (batch) await api(`/api/v1/imports/${batch.id}`, { method: "DELETE" }).catch(() => undefined);
      const r = await api<{ batchId: string; accountId: string; mapping: CsvMapping | null; header: string[] }>("/api/v1/imports", { body: { attachmentId: attId, accountId: accountId || null, mapping: m ?? undefined } });
      const b = await api<{ batch: { rows: ReviewRow[] } }>(`/api/v1/imports/${r.batchId}`);
      setBatch({ id: r.batchId, accountId: r.accountId, rows: b.batch.rows });
      setAccountId(r.accountId);
      setMapping(r.mapping);
      setHeader(r.header);
    } catch (e) {
      const code = (e as { code?: string }).code ?? (e as Error).message;
      setError(code === "file_missing" ? t("file_missing") : errText(Object.assign(e as object, { code })));
    } finally {
      setBusy(false);
    }
  };

  const setRow = (idx: number, patch: Partial<ReviewRow>) => setBatch((b) => (b ? { ...b, rows: b.rows.map((r) => (r.idx === idx ? { ...r, ...patch } : r)) } : b));

  const commit = async () => {
    if (!batch) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<typeof done>(`/api/v1/imports/${batch.id}/commit`, {
        body: { rows: batch.rows.map((x) => ({ idx: x.idx, skip: x.skip, categoryId: x.categoryId, billId: x.billId, chosenTxId: x.chosenTxId ?? null })) },
      });
      setDone(r);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Card className="max-w-2xl space-y-3">
        <Notice>{t("done", { matched: done.matched, created: done.created })}</Notice>
        {done.check ? <Notice tone={done.check.kind === "MATCH" ? "info" : "warn"}>{done.check.kind === "MATCH" ? t("checkMatch") : t("checkDiff", { amount: fmt(done.check.diff.replace("-", "")) })}</Notice> : null}
        <Link href={`/accounts/${batch?.accountId}`} className={btn.primary}>
          {t("openAccount")}
        </Link>
      </Card>
    );

  const colOptions = (
    <>
      <option value="">{t("none")}</option>
      {header.map((h, i) => (
        <option key={i} value={i}>
          {i + 1}: {h || "-"}
        </option>
      ))}
    </>
  );
  const colSelect = (key: keyof CsvMapping) => (
    <Select key={key} label={t(`col.${key}`)} value={mapping?.[key] == null ? "" : String(mapping[key])} onChange={(e) => setMapping((m) => (m ? { ...m, [key]: e.target.value === "" ? null : Number(e.target.value) } : m))}>
      {colOptions}
    </Select>
  );

  return (
    <div className="space-y-4">
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {!batch ? (
        <Card className="max-w-2xl space-y-4">
          <Select label={t("account")} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{t("accountAuto")}</option>
            {opts.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.last4 ? ` •${a.last4}` : ""}
              </option>
            ))}
          </Select>
          <label className="block">
            <span className="mb-1.5 block text-sm font-[550] text-ink">{t("file")}</span>
            <input type="file" accept=".csv,text/csv,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink file:mr-3 file:min-h-11 file:rounded-btn file:border file:border-line-strong/50 file:bg-surface file:px-4 file:font-[600] file:text-ink" />
          </label>
          <button type="button" className={btn.primary} onClick={() => read()} disabled={busy || !file}>
            {t("upload")}
          </button>
        </Card>
      ) : (
        <>
          {mapping ? (
            <details className="rounded-card-sm border border-line bg-surface p-4">
              <summary className="min-h-11 cursor-pointer content-center font-[600] text-ink">{t("mapping")}</summary>
              <p className="mb-3 text-sm text-muted">{t("mappingBody")}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(["date", "description", "amount", "debit", "credit", "direction", "balance"] as const).map(colSelect)}
                <Select label={t("dateFormat")} value={mapping.dateFormat} onChange={(e) => setMapping({ ...mapping, dateFormat: e.target.value as CsvMapping["dateFormat"] })}>
                  <option value="DMY">DD/MM/YYYY</option>
                  <option value="MDY">MM/DD/YYYY</option>
                  <option value="YMD">YYYY-MM-DD</option>
                </Select>
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={mapping.decimalComma} onChange={(e) => setMapping({ ...mapping, decimalComma: e.target.checked })} />
                  {t("decimalComma")}
                </label>
                <label className="text-sm">
                  <span className="mb-1.5 block font-[550] text-ink">{t("skipRows")}</span>
                  <input type="number" min={0} max={50} value={mapping.skipRows} onChange={(e) => setMapping({ ...mapping, skipRows: Number(e.target.value) || 0 })} className="min-h-11 w-full rounded-btn border border-line-strong/50 bg-surface px-3 text-ink" />
                </label>
              </div>
              <button type="button" className={btn.secondary + " mt-3"} onClick={() => read(mapping)} disabled={busy}>
                {t("reread")}
              </button>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[650] text-ink">
              {t("review")} · {acc?.name} · {t("rows", { count: batch.rows.length })}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={btn.ghost}
                onClick={async () => {
                  await api(`/api/v1/imports/${batch.id}`, { method: "DELETE" });
                  setBatch(null);
                  setAttachmentId(null);
                }}
              >
                {t("discard")}
              </button>
              <button type="button" className={btn.primary} onClick={commit} disabled={busy}>
                {t("commit")}
              </button>
            </div>
          </div>
          <Card flush>
            <ul className="divide-y divide-line">
              {batch.rows.map((r) => (
                <li key={r.idx} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", r.skip && "opacity-60")}>
                  <div className="min-w-0 flex-1 basis-[55%]">
                    <p className="truncate font-[550] text-ink">{r.description || "-"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>{r.date}</span>
                      {r.match.kind === "AUTO" ? <Chip>{t("matched")}</Chip> : r.match.kind === "TRANSFER" ? <Chip>{t("transfer")}</Chip> : r.match.kind === "NEW" ? <Chip active={false}>{t("new")}</Chip> : null}
                      {r.match.kind === "AUTO" && r.match.updateAmount ? <span>{t("fixAmount")}</span> : null}
                      {r.match.kind === "AUTO" ? <span className="truncate">{r.match.label}</span> : null}
                    </div>
                  </div>
                  <span className={cx("num shrink-0 font-[600]", r.direction === "IN" ? "text-accent" : "text-ink")}>
                    {r.direction === "IN" ? "+" : "\u2212"}
                    {fmt(r.amount)}
                  </span>
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    {r.match.kind === "CHOOSE" ? (
                      <label className="text-sm">
                        <span className="sr-only">{t("choose")}</span>
                        <select className="min-h-11 rounded-btn border border-line-strong/50 bg-surface px-2 text-ink" value={r.chosenTxId ?? ""} onChange={(e) => setRow(r.idx, { chosenTxId: e.target.value || null })}>
                          <option value="">{t("chooseNone")}</option>
                          {r.match.candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {r.match.kind === "NEW" || (r.match.kind === "CHOOSE" && !r.chosenTxId) ? (
                      <label className="text-sm">
                        <span className="sr-only">{ttx("fields.category")}</span>
                        <select className="min-h-11 max-w-[12rem] rounded-btn border border-line-strong/50 bg-surface px-2 text-ink" value={r.categoryId ?? ""} onChange={(e) => setRow(r.idx, { categoryId: e.target.value || null })}>
                          <option value="">{ttx("noCategory")}</option>
                          {opts.categories
                            .filter((c) => c.kind === (r.direction === "IN" ? "INCOME" : "EXPENSE"))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                      <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={r.skip} onChange={(e) => setRow(r.idx, { skip: e.target.checked })} />
                      {t("skip")}
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
