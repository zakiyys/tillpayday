"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { api } from "@/lib/api-client";
import { AccountForm, type AccountFormValue, type CurrencyOpt } from "./account-form";
import { Dialog } from "./dialog";
import { btn } from "./ui";

export function AddAccountButton({ autoOpen, ...p }: { currencies: CurrencyOpt[]; baseCurrency: string; today: string; showVisibility: boolean; variant?: "primary" | "secondary"; autoOpen?: boolean }) {
  const t = useTranslations("accounts");
  const [open, setOpen] = useState(!!autoOpen);
  return (
    <>
      <button type="button" className={btn[p.variant ?? "primary"]} onClick={() => setOpen(true)}>
        <Plus size={18} strokeWidth={1.75} aria-hidden />
        {t("add")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("add")}>
        <AccountForm {...p} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

export function EditAccountButton(p: { initial: AccountFormValue; currencies: CurrencyOpt[]; baseCurrency: string; today: string; showVisibility: boolean; archived: boolean }) {
  const t = useTranslations("accounts");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={btn.secondary} onClick={() => setOpen(true)}>
        <Pencil size={18} strokeWidth={1.75} aria-hidden />
        {tc("edit")}
      </button>
      <button
        type="button"
        className={btn.ghost}
        onClick={async () => {
          await api(`/api/v1/accounts/${p.initial.id}`, { method: "PATCH", body: { archived: !p.archived } });
          router.refresh();
        }}
      >
        {p.archived ? <ArchiveRestore size={18} strokeWidth={1.75} aria-hidden /> : <Archive size={18} strokeWidth={1.75} aria-hidden />}
        {p.archived ? tc("unarchive") : tc("archive")}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("edit")}>
        <AccountForm {...p} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
