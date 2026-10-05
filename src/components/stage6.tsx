"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import type { FormOptions } from "@/server/ui-data";
import { FormDialog } from "./form-dialog";
import { Checkbox, Select, TextInput } from "./form";
import { MoneyInput } from "./money-input";
import { majorStrToMinor, parseMajor } from "@/lib/format";

type Opts = Pick<FormOptions, "accounts" | "categories" | "currencies">;
const expOf = (opts: Opts, c: string) => opts.currencies.find((x) => x.code === c)?.exponent ?? 2;
const decimal = (v: FormDataEntryValue | null) => String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
const decimalLoose = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  // "9000", "9.000" (thousands), "12,5", "12.5" all become plain decimals.
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return s.replace(/\./g, "");
  return s.replace(",", ".");
};
const ownAccounts = (opts: Opts) => opts.accounts.filter((a) => ["BANK", "EWALLET", "CASH", "INVESTMENT"].includes(a.type));
const AccountOptions = ({ list }: { list: Opts["accounts"] }) => (
  <>
    {list.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name}
        {a.last4 ? ` •${a.last4}` : ""} ({a.currency})
      </option>
    ))}
  </>
);

export function DebtButton({ opts, base, today }: { opts: Opts; base: string; today: string }) {
  const t = useTranslations("debts");
  const ttx = useTranslations("tx");
  return (
    <FormDialog
      label={t("record")}
      title={t("recordTitle")}
      endpoint="/api/v1/debts"
      ns="debts"
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({ direction: f.get("direction"), counterparty: f.get("person"), accountId: f.get("accountId"), amount: f.get("amount"), occurredOn: f.get("date"), note: f.get("note") || null })}
    >
      <Select label={t("direction.label")} name="direction">
        {(["BORROW", "LEND", "REPAY", "REPAID"] as const).map((d) => (
          <option key={d} value={d}>
            {t(`direction.${d}`)}
          </option>
        ))}
      </Select>
      <TextInput label={t("person")} name="person" required maxLength={80} />
      <Select label={t("account")} name="accountId">
        <AccountOptions list={ownAccounts(opts)} />
      </Select>
      <MoneyInput label={ttx("fields.amount")} name="amount" exp={expOf(opts, base)} currency={base} required />
      <TextInput label={ttx("fields.date")} name="date" type="date" defaultValue={today} required />
      <TextInput label={ttx("fields.note")} name="note" maxLength={500} />
    </FormDialog>
  );
}

export function SplitButton({ opts, base, today }: { opts: Opts; base: string; today: string }) {
  const t = useTranslations("debts");
  const ttx = useTranslations("tx");
  return (
    <FormDialog
      label={t("split")}
      title={t("splitTitle")}
      endpoint="/api/v1/splits"
      ns="debts"
      submitLabel={useTranslations("common")("save")}
      build={(f) => {
        const names = String(f.get("names") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return { accountId: f.get("accountId"), total: f.get("total"), occurredOn: f.get("date"), categoryId: f.get("categoryId") || null, payee: f.get("payee") || null, ...(names.length ? { counterparties: names } : { people: Number(f.get("people")) }) };
      }}
    >
      <TextInput label={ttx("fields.payee")} name="payee" maxLength={120} />
      <MoneyInput label={t("splitTotal")} name="total" exp={expOf(opts, base)} currency={base} required />
      <Select label={ttx("fields.account")} name="accountId">
        <AccountOptions list={opts.accounts.filter((a) => a.type !== "RECEIVABLE" && a.type !== "PERSONAL_DEBT" && a.type !== "LOAN")} />
      </Select>
      <TextInput label={t("splitPeople")} name="people" type="number" min={2} max={50} defaultValue={2} />
      <TextInput label={t("splitNames")} help={t("splitNamesHelp")} name="names" />
      <Select label={ttx("fields.category")} name="categoryId">
        {opts.categories
          .filter((c) => c.kind === "EXPENSE")
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <TextInput label={ttx("fields.date")} name="date" type="date" defaultValue={today} required />
    </FormDialog>
  );
}

export function InstallmentButton({ opts, base, today }: { opts: Opts; base: string; today: string }) {
  const t = useTranslations("debts");
  const ttx = useTranslations("tx");
  const cards = opts.accounts.filter((a) => a.type === "CREDIT_CARD" || a.type === "PAYLATER");
  return (
    <FormDialog
      label={t("installment")}
      title={t("installmentTitle")}
      endpoint="/api/v1/installments"
      disabled={!cards.length}
      sync
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({
        accountId: f.get("accountId"),
        description: f.get("description"),
        totalAmount: f.get("total"),
        months: Number(f.get("months")),
        startDate: f.get("start"),
        purchaseDate: f.get("date"),
        categoryId: f.get("categoryId") || null,
        fullRecognition: f.get("full") === "on",
      })}
    >
      <TextInput label={t("description")} name="description" required maxLength={120} />
      <Select label={ttx("fields.account")} name="accountId">
        <AccountOptions list={cards} />
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label={ttx("fields.amount")} name="total" exp={expOf(opts, base)} currency={base} required />
        <TextInput label={t("months")} name="months" type="number" min={2} max={60} defaultValue={12} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={ttx("fields.date")} name="date" type="date" defaultValue={today} required />
        <TextInput label={t("firstDue")} name="start" type="date" defaultValue={today} required />
      </div>
      <Select label={ttx("fields.category")} name="categoryId">
        {opts.categories
          .filter((c) => c.kind === "EXPENSE")
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <Checkbox label={t("installmentFull")} name="full" />
    </FormDialog>
  );
}

export function LoanPayButton({ loan, opts, today }: { loan: { id: string; name: string; currency: string }; opts: Opts; today: string }) {
  const t = useTranslations("debts");
  const ttx = useTranslations("tx");
  return (
    <FormDialog
      label={t("payLoan")}
      title={t("payLoanTitle", { name: loan.name })}
      endpoint="/api/v1/loans/pay"
      ns="debts"
      ariaLabel={`${t("payLoan")}: ${loan.name}`}
      submitLabel={t("payLoan")}
      build={(f) => ({ loanAccountId: loan.id, fromAccountId: f.get("from"), amount: f.get("amount"), occurredOn: f.get("date") })}
    >
      <Select label={ttx("fields.from")} name="from">
        <AccountOptions list={ownAccounts(opts).filter((a) => a.currency === loan.currency)} />
      </Select>
      <MoneyInput label={ttx("fields.amount")} name="amount" exp={expOf(opts, loan.currency)} currency={loan.currency} required />
      <TextInput label={ttx("fields.date")} name="date" type="date" defaultValue={today} required />
    </FormDialog>
  );
}

// ---------- Investments ----------

export interface AssetTypeOpt {
  id: string;
  name: string;
  unitLabel: string;
  valuation: string;
}

export function HoldingButton({ opts, types }: { opts: Opts; types: AssetTypeOpt[] }) {
  const t = useTranslations("invest");
  const invest = opts.accounts.filter((a) => a.type === "INVESTMENT" || a.type === "BANK" || a.type === "CASH");
  return (
    <FormDialog
      label={
        <>
          <Plus size={18} strokeWidth={1.75} aria-hidden />
          {t("addHolding")}
        </>
      }
      variant="primary"
      title={t("addHolding")}
      endpoint="/api/v1/holdings"
      ns="invest"
      disabled={!invest.length}
      submitLabel={useTranslations("common")("save")}
      build={(f) => {
        const acc = invest.find((a) => a.id === f.get("accountId"));
        const currency = String(f.get("currency") || acc?.currency || "");
        const p = parseMajor(String(f.get("principal") ?? ""));
        const principal = p ? majorStrToMinor(p, expOf(opts, currency)) : null;
        return {
          accountId: f.get("accountId"),
          assetTypeId: f.get("assetTypeId"),
          name: f.get("name"),
          symbol: f.get("symbol") || null,
          currency,
          principal: principal?.toString() ?? null,
          interestRate: f.get("rate") ? decimal(f.get("rate")) : null,
          startDate: f.get("start") || null,
          maturityDate: f.get("maturity") || null,
        };
      }}
    >
      <TextInput label={t("fields.name")} name="name" required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <Select label={t("fields.type")} name="assetTypeId">
          {types.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
        <TextInput label={t("fields.symbol")} name="symbol" maxLength={30} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label={t("fields.account")} name="accountId">
          <AccountOptions list={invest} />
        </Select>
        <Select label={t("fields.currency")} name="currency" defaultValue="">
          <option value="">{t("sameAsAccount")}</option>
          {opts.currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-muted">
        {t("valuation.FIXED_PLUS_INTEREST")}: {t("fields.principal")}, {t("fields.rate")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t("fields.principal")} name="principal" inputMode="decimal" />
        <TextInput label={t("fields.rate")} name="rate" inputMode="decimal" />
        <TextInput label={t("fields.start")} name="start" type="date" />
        <TextInput label={t("fields.maturity")} name="maturity" type="date" />
      </div>
    </FormDialog>
  );
}

export function TradeButton({ side, holding, opts, today }: { side: "BUY" | "SELL"; holding: { id: string; name: string; currency: string; unitLabel: string; accountId: string }; opts: Opts; today: string }) {
  const t = useTranslations("invest");
  const label = side === "BUY" ? t("buy") : t("sell");
  const cash = ownAccounts(opts).filter((a) => a.currency === holding.currency);
  return (
    <FormDialog
      label={label}
      ariaLabel={`${label}: ${holding.name}`}
      title={t("tradeTitle", { side: label, name: holding.name })}
      endpoint="/api/v1/holdings/trade"
      ns="invest"
      submitLabel={label}
      build={(f) => ({ side, holdingId: holding.id, accountId: f.get("accountId"), units: decimal(f.get("units")), unitPrice: decimalLoose(f.get("price")), feeAmount: f.get("fee") || "0", occurredOn: f.get("date") })}
    >
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={`${t("units")} (${holding.unitLabel})`} name="units" inputMode="decimal" required />
        <TextInput label={t("unitPrice")} help={t("unitPriceHelp", { unit: holding.unitLabel })} name="price" inputMode="decimal" required />
      </div>
      <MoneyInput label={t("fee")} name="fee" exp={expOf(opts, holding.currency)} currency={holding.currency} />
      <Select label={t("payFrom")} name="accountId" defaultValue={holding.accountId}>
        <AccountOptions list={cash} />
      </Select>
      <TextInput label={t("date")} name="date" type="date" defaultValue={today} required />
    </FormDialog>
  );
}

export function PriceButton({ holding, today, appraised }: { holding: { id: string; name: string; unitLabel: string }; today: string; appraised: boolean }) {
  const t = useTranslations("invest");
  return (
    <FormDialog
      label={t("setPrice")}
      ariaLabel={`${t("setPrice")}: ${holding.name}`}
      variant="ghost"
      title={`${t("setPrice")}: ${holding.name}`}
      endpoint="/api/v1/prices"
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({ holdingId: holding.id, price: decimalLoose(f.get("price")), date: f.get("date") })}
    >
      <TextInput label={appraised ? t("appraised") : `${t("price")} / ${holding.unitLabel}`} name="price" inputMode="decimal" required />
      <TextInput label={t("date")} name="date" type="date" defaultValue={today} required />
    </FormDialog>
  );
}

export function AssetTypeButton() {
  const t = useTranslations("invest");
  return (
    <FormDialog
      label={t("addType")}
      title={t("addType")}
      endpoint="/api/v1/asset-types"
      ns="invest"
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({ name: f.get("name"), unitLabel: f.get("unitLabel"), unitSize: decimal(f.get("unitSize")) || "1", valuation: f.get("valuation"), priceSource: f.get("priceSource") })}
    >
      <TextInput label={t("fields.name")} name="name" required maxLength={60} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t("fields.unitLabel")} name="unitLabel" required maxLength={20} defaultValue="unit" />
        <TextInput label={t("fields.unitSize")} help={t("fields.unitSizeHelp")} name="unitSize" inputMode="decimal" defaultValue="1" />
      </div>
      <Select label={t("fields.valuation")} name="valuation">
        {(["UNITS_TIMES_PRICE", "FIXED_PLUS_INTEREST", "APPRAISED"] as const).map((v) => (
          <option key={v} value={v}>
            {t(`valuation.${v}`)}
          </option>
        ))}
      </Select>
      <Select label={t("fields.priceSource")} name="priceSource" help={t("noProvider")}>
        {(["MANUAL", "FIXED"] as const).map((v) => (
          <option key={v} value={v}>
            {t(`priceSource.${v}`)}
          </option>
        ))}
      </Select>
    </FormDialog>
  );
}

// ---------- Trips ----------

export function TripButton({ opts, base, today, goals }: { opts: Opts; base: string; today: string; goals: Array<{ id: string; name: string }> }) {
  const t = useTranslations("trips");
  return (
    <FormDialog
      label={
        <>
          <Plus size={18} strokeWidth={1.75} aria-hidden />
          {t("add")}
        </>
      }
      variant="primary"
      title={t("add")}
      endpoint="/api/v1/trips"
      ns="trips"
      submitLabel={useTranslations("common")("save")}
      build={(f) => ({ name: f.get("name"), startDate: f.get("start"), endDate: f.get("end") || null, defaultCurrency: f.get("currency"), goalId: f.get("goalId") || null, active: true })}
    >
      <TextInput label={t("fields.name")} name="name" required maxLength={80} />
      <div className="grid grid-cols-2 gap-3">
        <TextInput label={t("fields.start")} name="start" type="date" defaultValue={today} required />
        <TextInput label={t("fields.end")} name="end" type="date" />
      </div>
      <Select label={t("fields.currency")} name="currency" defaultValue={base}>
        {opts.currencies.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </Select>
      <Select label={t("fields.goal")} name="goalId">
        <option value="">{t("noGoal")}</option>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </Select>
    </FormDialog>
  );
}

export function RefillButton({ trip, amount, amountText, opts, today }: { trip: { id: string; name: string }; amount: string; amountText: string; opts: Opts; today: string }) {
  const t = useTranslations("trips");
  return (
    <FormDialog
      label={t("refill")}
      title={t("refillTitle", { amount: amountText })}
      endpoint="/api/v1/trips/refill"
      ns="trips"
      submitLabel={t("refill")}
      build={(f) => ({ tripId: trip.id, fromAccountId: f.get("from"), toAccountId: f.get("to"), amount, date: today })}
    >
      <p className="text-sm text-muted">{t("refillBody", { amount: amountText })}</p>
      <Select label={t("from")} name="from">
        <AccountOptions list={opts.accounts.filter((a) => a.role === "SAVINGS")} />
      </Select>
      <Select label={t("to")} name="to">
        <AccountOptions list={opts.accounts.filter((a) => a.role === "DAILY")} />
      </Select>
    </FormDialog>
  );
}
