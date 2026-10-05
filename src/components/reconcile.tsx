"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import { MoneyInput } from "./money-input";
import { Dialog } from "./dialog";
import { useErrorText } from "./form";
import { btn, Notice } from "./ui";

type Proposal =
  | { kind: "MATCH"; diff: string }
  | { kind: "SMALL"; diff: string; suggestion: "ADMIN_FEE" | "INTEREST"; amount: string }
  | { kind: "LARGE"; diff: string; amount: string };

export function ReconcileButton({ account, exp, intl, today }: { account: { id: string; name: string; currency: string }; exp: number; intl: string; today: string }) {
  const t = useTranslations("accounts");
  const errText = useErrorText("accounts");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState<string | null>(null);
  const [res, setRes] = useState<{ proposal: Proposal; recorded: string; recurringFee: string | null } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fmt = (v: string) => money(BigInt(v), account.currency, intl, { exp });

  const call = async (decision?: string): Promise<void> => {
    setError(null);
    try {
      const r = await api<{ proposal: Proposal; recorded: string; recurringFee: string | null }>(`/api/v1/accounts/${account.id}/reconcile`, {
        body: { reported, date: today, decision },
      });
      if (!decision && r.proposal.kind === "MATCH") return call("SKIP").then(() => setDone(t("match")));
      setRes(r);
      if (decision) {
        router.refresh();
        if (r.recurringFee) setDone(t("recurringFee", { amount: fmt(r.recurringFee) }));
        else close();
      }
    } catch (e) {
      setError(errText(e));
    }
  };
  const close = () => {
    setOpen(false);
    setRes(null);
    setReported(null);
    setDone(null);
  };

  const p = res?.proposal;
  return (
    <>
      <button type="button" className={btn.secondary} onClick={() => setOpen(true)}>
        {t("check")}
      </button>
      <Dialog open={open} onClose={close} title={t("checkTitle", { name: account.name })}>
        <div className="space-y-4">
          {error ? <Notice tone="warn">{error}</Notice> : null}
          {done ? (
            <>
              <Notice>{done}</Notice>
              {res?.recurringFee ? (
                <Link href="/bills?new=fee" className={btn.secondary}>
                  {t("recurringAdd")}
                </Link>
              ) : null}
              <button type="button" className={btn.primary + " w-full"} onClick={close}>
                OK
              </button>
            </>
          ) : !p ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void call();
              }}
            >
              <p className="text-sm text-muted">{t("checkBody")}</p>
              <MoneyInput label={t("reported")} name="reported" exp={exp} currency={account.currency} onMinor={setReported} allowNegative required />
              <button type="submit" className={btn.primary + " w-full"} disabled={reported == null}>
                {t("check")}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t("recorded", { amount: fmt(res!.recorded) })}</p>
              {p.kind === "SMALL" ? (
                <>
                  <Notice>{p.suggestion === "ADMIN_FEE" ? t("smallFee", { amount: fmt(p.amount) }) : t("smallInterest", { amount: fmt(p.amount) })}</Notice>
                  <button type="button" className={btn.primary + " w-full"} onClick={() => call("ACCEPT_CATEGORY")}>
                    {p.suggestion === "ADMIN_FEE" ? t("acceptFee") : t("acceptInterest")}
                  </button>
                  <button type="button" className={btn.secondary + " w-full"} onClick={() => call("NEUTRAL")}>
                    {t("neutral")}
                  </button>
                </>
              ) : p.kind === "LARGE" ? (
                <>
                  <Notice tone="warn">{t("large", { amount: fmt(p.amount) })}</Notice>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href={`/import?account=${account.id}`} className={btn.secondary}>
                      {t("largeImport")}
                    </Link>
                    <Link href={`/transactions?new=1&account=${account.id}`} className={btn.secondary}>
                      {t("largeManual")}
                    </Link>
                  </div>
                  <button type="button" className={btn.danger + " w-full"} onClick={() => call("FORCE")}>
                    {t("force")}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
