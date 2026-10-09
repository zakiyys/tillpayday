"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { longDate, money } from "@/lib/format";
import type { TxRow } from "@/lib/tx-row";
import type { FormOptions } from "@/server/ui-data";
import { Dialog } from "./dialog";
import { TxForm } from "./tx-form";
import { Chip, Notice, cx } from "./ui";
import { AccountLogo } from "./account-logo";
import { useErrorText } from "./form";

/** Signed display amount for a row as seen from `viewAccountId` (or overall when null). */
function signed(r: TxRow, viewAccountId?: string | null): { value: bigint; sign: boolean; currency: string } {
  const a = BigInt(r.amount);
  if (r.type === "INCOME" || r.type === "ASSET_SELL") return { value: a, sign: true, currency: r.currency };
  if (r.type === "EXPENSE" || r.type === "ASSET_BUY") return { value: -a, sign: true, currency: r.currency };
  if (r.type === "OPENING" || r.type === "ADJUSTMENT") return { value: a, sign: true, currency: r.currency };
  if (viewAccountId && r.counterAccountId === viewAccountId)
    return { value: BigInt(r.counterAmount ?? r.amount), sign: true, currency: r.counterCurrency ?? r.currency };
  if (viewAccountId && r.accountId === viewAccountId) return { value: -a, sign: true, currency: r.currency };
  return { value: a, sign: false, currency: r.currency };
}

export function TxList({
  rows,
  intl,
  opts,
  base,
  today,
  viewAccountId,
  compact = false,
}: {
  rows: TxRow[];
  intl: string;
  opts: Pick<FormOptions, "accounts" | "categories" | "currencies">;
  base: string;
  today: string;
  viewAccountId?: string | null;
  compact?: boolean;
}) {
  const t = useTranslations("tx");
  const tc = useTranslations("common");
  const errText = useErrorText("tx");
  const router = useRouter();
  const [edit, setEdit] = useState<TxRow | null>(null);
  const [undo, setUndo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exp = (c: string) => opts.currencies.find((x) => x.code === c)?.exponent;
  const acc = (id: string) => opts.accounts.find((a) => a.id === id);
  // Spending per day header, in the base currency, so a day's total is visible without adding rows up.
  const dayTotals = new Map<string, bigint>();
  if (!compact && !viewAccountId)
    for (const r of rows) if (r.type === "EXPENSE" && !r.deleted && r.currency === base) dayTotals.set(r.occurredOn, (dayTotals.get(r.occurredOn) ?? 0n) + BigInt(r.amount));

  const remove = async (id: string) => {
    setError(null);
    try {
      await api(`/api/v1/transactions/${id}`, { method: "DELETE" });
      setUndo(id);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    }
  };
  const restore = async (id: string) => {
    setError(null);
    try {
      await api(`/api/v1/transactions/${id}/restore`, { body: {} });
      setUndo(null);
      router.refresh();
    } catch (e) {
      setError(errText(e));
    }
  };

  return (
    <>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      {undo ? (
        <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-btn border border-line bg-surface px-3 py-2 text-sm">
          <span>{t("deleted")}</span>
          <button type="button" className="min-h-11 px-2 font-[650] text-accent" onClick={() => restore(undo)}>
            {t("undo")}
          </button>
        </div>
      ) : null}
      <ul className="divide-y divide-line">
        {rows.map((r, idx) => {
          const s = signed(r, viewAccountId);
          const showDate = !compact && (idx === 0 || rows[idx - 1]!.occurredOn !== r.occurredOn);
          const title = r.type === "TRANSFER" ? t("transferArrow", { from: r.accountName, to: r.counterAccountName ?? "" }) : r.payee || r.categoryName || t(`type.${r.type}`);
          const editable = !r.deleted && ["INCOME", "EXPENSE", "TRANSFER", "ADJUSTMENT"].includes(r.type);
          return (
            <Fragment key={r.id}>
              {showDate ? (
                <li className="flex items-baseline justify-between gap-3 bg-surface-2 px-4 pb-1.5 pt-3 text-xs font-[650] text-muted">
                  <span>{r.occurredOn === today ? tc("today") : longDate(r.occurredOn, intl, today)}</span>
                  {dayTotals.get(r.occurredOn) ? <span className="num font-[550]">{money(-dayTotals.get(r.occurredOn)!, base, intl, { sign: true, exp: exp(base) })}</span> : null}
                </li>
              ) : null}
              <li className={cx("flex items-center gap-3 px-4 py-3", r.deleted && "opacity-70")}>
                {r.type === "TRANSFER" ? (
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-surface-2 text-muted">
                    <ArrowLeftRight size={18} strokeWidth={1.75} />
                  </span>
                ) : (
                  <AccountLogo type={acc(r.accountId)?.type ?? "BANK"} institution={acc(r.accountId)?.institution} name={r.accountName} size={36} />
                )}
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setEdit(r)}
                  aria-label={editable ? `${tc("edit")}: ${title}` : undefined}
                  className="min-w-0 flex-1 text-left disabled:cursor-default md:pointer-events-none"
                  tabIndex={editable ? undefined : -1}
                >
                  <p className="line-clamp-2 font-[600] text-ink">{title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {r.categoryName && r.type !== "TRANSFER" ? <Chip>{r.categoryName}</Chip> : null}
                    {r.type !== "TRANSFER" && !viewAccountId ? <span className="truncate">{r.accountName}</span> : null}
                    {compact ? <span>{r.occurredOn === today ? tc("today") : longDate(r.occurredOn, intl, today)}</span> : null}
                    {r.fxRateIsEstimate ? <span>· {t("estimate")}</span> : null}
                    {r.note ? <span className="truncate">· {r.note}</span> : null}
                  </div>
                </button>
                <span className={cx("num shrink-0 font-[650]", s.sign && s.value > 0n ? "text-accent" : "text-ink")}>
                  {money(s.value, s.currency, intl, { sign: s.sign, exp: exp(s.currency) })}
                </span>
                {!compact ? (
                  <div className={cx("shrink-0", editable ? "hidden md:flex" : "flex")}>
                    {editable ? (
                      <>
                        <button type="button" className="grid size-11 place-items-center rounded-btn text-muted hover:bg-surface-2" aria-label={`${tc("edit")}: ${title}`} onClick={() => setEdit(r)}>
                          <Pencil size={18} strokeWidth={1.75} aria-hidden />
                        </button>
                        <button type="button" className="grid size-11 place-items-center rounded-btn text-muted hover:bg-surface-2" aria-label={`${tc("delete")}: ${title}`} onClick={() => remove(r.id)}>
                          <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                        </button>
                      </>
                    ) : r.deleted ? (
                      <button type="button" className="grid size-11 place-items-center rounded-btn text-muted hover:bg-surface-2" aria-label={`${tc("restore")}: ${title}`} onClick={() => restore(r.id)}>
                        <RotateCcw size={18} strokeWidth={1.75} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            </Fragment>
          );
        })}
      </ul>
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={t("edit")}>
        {edit ? (
          <TxForm
            opts={opts}
            base={base}
            today={today}
            initial={{ ...edit, type: edit.type as "INCOME" }}
            onDone={() => setEdit(null)}
          />
        ) : null}
        {edit ? (
          <button
            type="button"
            className="press mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-btn border border-warning/60 text-sm font-[600] text-warning"
            onClick={() => {
              const id = edit.id;
              setEdit(null);
              void remove(id);
            }}
          >
            <Trash2 size={18} strokeWidth={1.75} aria-hidden />
            {tc("delete")}
          </button>
        ) : null}
      </Dialog>
    </>
  );
}

export function AddTxButton(p: { opts: Pick<FormOptions, "accounts" | "categories" | "currencies">; base: string; today: string; defaultAccountId?: string; autoOpen?: boolean }) {
  const t = useTranslations("tx");
  const [open, setOpen] = useState(!!p.autoOpen);
  return (
    <>
      <button type="button" className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-btn bg-accent px-4 text-sm font-[600] text-on-accent" onClick={() => setOpen(true)} disabled={!p.opts.accounts.length}>
        {t("add")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("add")}>
        <TxForm opts={p.opts} base={p.base} today={p.today} defaultAccountId={p.defaultAccountId} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
