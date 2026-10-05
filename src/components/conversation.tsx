"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { longDate, money, minorToInput, parseMajor, majorStrToMinor } from "@/lib/format";
import { missingFields, type Proposal } from "@/lib/proposals";
import type { FormOptions } from "@/server/ui-data";
import { useErrorText } from "./form";
import { Chip, Notice, btn, cx } from "./ui";
import { enqueueOffline } from "@/lib/offline-queue";

type Opts = Pick<FormOptions, "accounts" | "categories" | "currencies">;

interface Turn {
  id: string;
  at: string;
  date: string;
  input: string;
  photo?: boolean;
  status: "thinking" | "ready" | "saved" | "cancelled" | "manual" | "queued" | "error" | "offline";
  proposals: Proposal[];
  attachmentId?: string | null;
  draftId?: string | null;
  error?: string;
}

const STORE = "record-thread-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

/** Proposals without question entries, so question.forIndex points at the right one. */
const mains = (ps: Proposal[]) => ps.filter((p) => p.kind !== "question");

export function Conversation({ opts, intl, today, base, aiState, initialText, drafts }: { opts: Opts; intl: string; today: string; base: string; aiState: "off" | "ok" | "down" | "novision"; initialText?: string; drafts: Array<{ id: string; text: string | null; proposals: Proposal[] | null; source: string }> }) {
  const t = useTranslations("record");
  const errText = useErrorText("record");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [online, setOnline] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    // Thread survives navigation within this tab. Only fills an empty thread, so a submit that already
    // started (dev double-invoked effects, ?q= from the input bar) is never overwritten.
    let stored: Turn[] = [];
    try {
      stored = (JSON.parse(sessionStorage.getItem(STORE) ?? "[]") as Turn[]).filter((x) => x.status !== "thinking");
    } catch {
      stored = [];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from this tab's storage
    if (stored.length) setTurns((cur) => (cur.length ? cur : stored));
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    sessionStorage.setItem(STORE, JSON.stringify(turns.slice(-30)));
    end.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  const update = (id: string, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => setTurns((ts) => ts.map((x) => (x.id === id ? { ...x, ...(typeof patch === "function" ? patch(x) : patch) } : x)));

  const submit = useCallback(
    async (input: string, photo?: File) => {
      const id = uid();
      const turn: Turn = { id, at: new Date().toISOString(), date: today, input: photo ? (input || photo.name) : input, photo: !!photo, status: "thinking", proposals: [] };
      setTurns((ts) => [...ts, turn]);
      if (!navigator.onLine) {
        await enqueueOffline({ text: input, file: photo ?? null });
        update(id, { status: "offline" });
        return;
      }
      try {
        let r: { status: string; proposals: Proposal[]; attachmentId?: string | null; draftId?: string };
        if (photo) {
          const fd = new FormData();
          fd.set("file", photo);
          if (input) fd.set("text", input);
          const res = await fetch("/api/v1/ingest", { method: "POST", body: fd, credentials: "same-origin" });
          const data = await res.json();
          if (!res.ok) throw new ApiError(res.status, data?.error ?? "internal");
          r = data;
        } else r = await api("/api/v1/ingest", { body: { text: input } });
        update(id, { status: r.status === "manual" ? "manual" : r.status === "queued" ? "queued" : "ready", proposals: r.proposals, attachmentId: r.attachmentId ?? null, draftId: r.draftId ?? null });
      } catch (e) {
        if (e instanceof TypeError) {
          await enqueueOffline({ text: input, file: photo ?? null });
          update(id, { status: "offline" });
        } else update(id, { status: "error", error: errText(e) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today],
  );

  useEffect(() => {
    if (initialText && !started.current) {
      started.current = true;
      void submit(initialText);
      window.history.replaceState(null, "", "/record");
    }
  }, [initialText, submit]);

  const save = async (turn: Turn) => {
    try {
      await api("/api/v1/ingest/confirm", { body: { proposals: mains(turn.proposals).filter((p) => !["answer", "manual"].includes(p.kind)), rawText: turn.input, source: turn.photo ? "PHOTO" : "TEXT", attachmentId: turn.attachmentId, draftId: turn.draftId } });
      update(turn.id, { status: "saved" });
    } catch (e) {
      update(turn.id, { error: errText(e) });
    }
  };

  const fmt = (v: string, c: string) => money(BigInt(v), c, intl, { exp: opts.currencies.find((x) => x.code === c)?.exponent });
  const accName = (id?: string | null) => opts.accounts.find((a) => a.id === id)?.name;
  const catName = (id?: string | null) => opts.categories.find((c) => c.id === id)?.name;

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      {aiState !== "ok" ? (
        <div className="mb-3">
          <Notice>{aiState === "off" ? t("aiOff") : aiState === "down" ? t("aiDown") : t("noVision")}</Notice>
        </div>
      ) : null}
      {!online ? (
        <div className="mb-3">
          <Notice tone="warn">{t("offline")}</Notice>
        </div>
      ) : null}

      {drafts.length ? (
        <section aria-labelledby="drafts-h" className="mb-4 space-y-2">
          <h2 id="drafts-h" className="text-sm font-[650] text-ink">
            {t("drafts")}
          </h2>
          {drafts.map((d) => (
            <DraftRow key={d.id} d={d} onOpen={(ps) => setTurns((ts) => [...ts, { id: uid(), at: new Date().toISOString(), date: today, input: d.text ?? t("draftFrom", { source: d.source }), status: "ready", proposals: ps, draftId: d.id }])} />
          ))}
        </section>
      ) : null}

      {turns.length === 0 ? (
        <div className="rounded-card-sm border border-dashed border-line-strong/40 p-5 text-center text-sm text-muted">
          <p className="font-[600] text-ink">{t("empty")}</p>
          <p className="mt-1">{t("examples")}</p>
        </div>
      ) : null}

      <ol className="space-y-3" aria-live="polite">
        {turns.map((turn, i) => {
          const sep = i === 0 || turns[i - 1]!.date !== turn.date;
          return (
            <li key={turn.id} className="space-y-2">
              {sep ? (
                <div className="flex items-center gap-3 py-1 text-xs font-[600] text-muted" role="separator">
                  <span className="h-px flex-1 bg-line" />
                  {longDate(turn.date, intl)}
                  <span className="h-px flex-1 bg-line" />
                </div>
              ) : null}
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-[18px] rounded-br-md bg-accent px-4 py-2.5 text-on-accent">{turn.input}</p>
              </div>
              <ReplyCard turn={turn} base={base} opts={opts} fmt={fmt} accName={accName} catName={catName} onChange={(ps) => update(turn.id, { proposals: ps })} onSave={() => save(turn)} onCancel={() => update(turn.id, { status: "cancelled" })} today={today} />
            </li>
          );
        })}
      </ol>
      <div ref={end} />

      <form
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 mt-4 bg-canvas py-2 lg:bottom-0"
        onSubmit={(e) => {
          e.preventDefault();
          const v = text.trim();
          if (!v) return;
          setText("");
          void submit(v);
        }}
      >
        <InputRow value={text} onChange={setText} onPhoto={() => file.current?.click()} photoDisabled={aiState === "novision" || aiState === "off"} />
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void submit(text.trim(), f);
            setText("");
          }}
        />
      </form>
    </div>
  );
}

export function InputRow({ value, onChange, onPhoto, photoDisabled }: { value: string; onChange: (v: string) => void; onPhoto: () => void; photoDisabled?: boolean }) {
  const t = useTranslations("record");
  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-float">
      <button type="button" onClick={onPhoto} disabled={photoDisabled} aria-label={t("photo")} title={photoDisabled ? t("noVision") : undefined} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-40">
        <Camera size={20} strokeWidth={1.75} aria-hidden />
      </button>
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("inputLabel")}</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("placeholder")} className="h-11 w-full bg-transparent px-1 text-base text-ink placeholder:text-muted focus-visible:outline-none" enterKeyHint="send" autoComplete="off" />
      </label>
      <button type="submit" aria-label={t("send")} className="press grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent disabled:opacity-50" disabled={!value.trim()}>
        <Send size={18} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

function DraftRow({ d, onOpen }: { d: { id: string; text: string | null; proposals: Proposal[] | null; source: string }; onOpen: (ps: Proposal[]) => void }) {
  const t = useTranslations("record");
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="flex items-center gap-2 rounded-btn border border-line bg-surface px-3 py-1.5 text-sm">
      <span className="min-w-0 flex-1 truncate text-ink">{d.text ?? t("draftFrom", { source: d.source })}</span>
      {d.proposals ? (
        <button
          type="button"
          className={btn.ghost}
          onClick={() => {
            onOpen(d.proposals!);
            setGone(true);
          }}
        >
          {t("change")}
        </button>
      ) : null}
      <button
        type="button"
        className={btn.ghost}
        onClick={async () => {
          await api(`/api/v1/ingest/drafts/${d.id}`, { method: "DELETE" });
          setGone(true);
        }}
      >
        {t("discard")}
      </button>
    </div>
  );
}

function ReplyCard({
  turn,
  base,
  opts,
  fmt,
  accName,
  catName,
  onChange,
  onSave,
  onCancel,
  today,
}: {
  turn: Turn;
  base: string;
  opts: Opts;
  fmt: (v: string, c: string) => string;
  accName: (id?: string | null) => string | undefined;
  catName: (id?: string | null) => string | undefined;
  onChange: (ps: Proposal[]) => void;
  onSave: () => void;
  onCancel: () => void;
  today: string;
}) {
  const t = useTranslations("record");
  const ttx = useTranslations("tx");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState(false);
  if (turn.status === "thinking")
    return (
      <div className="w-[85%] rounded-card-sm border border-line bg-surface p-4" aria-busy="true">
        <span className="sr-only">{tc("loading")}</span>
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton mt-2 h-4 w-1/3" />
      </div>
    );
  if (turn.status === "offline") return <Notice>{t("queuedOffline")}</Notice>;
  if (turn.status === "queued") return <Notice>{t("queuedPhoto")}</Notice>;
  if (turn.status === "error") return <Notice tone="warn">{turn.error}</Notice>;

  const ms = mains(turn.proposals);
  const questions = turn.proposals.filter((p): p is Extract<Proposal, { kind: "question" }> => p.kind === "question");
  const open = questions.filter((q) => {
    const target = ms[q.forIndex];
    return target && (missingFields(target).length > 0 || (q.options.some((o) => "kind" in o.patch || "type" in o.patch) && !(target as { answered?: boolean }).answered));
  });
  const savable = ms.filter((p) => !["answer", "manual"].includes(p.kind));
  const incomplete = savable.some((p) => missingFields(p).length > 0) || open.length > 0;

  const answer = (q: Extract<Proposal, { kind: "question" }>, patch: Record<string, unknown>) => {
    const next: Proposal[] = [...ms];
    const cur = next[q.forIndex]!;
    next[q.forIndex] = ("kind" in patch ? { ...patch } : { ...cur, ...patch, answered: true }) as Proposal;
    if ("kind" in patch || "type" in patch) (next[q.forIndex] as { answered?: boolean }).answered = true;
    onChange([...next, ...questions.filter((x) => x !== q)]);
  };
  const setMain = (i: number, p: Proposal) => {
    const next: Proposal[] = [...ms];
    next[i] = p;
    onChange([...next, ...questions]);
  };

  return (
    <div className="w-full max-w-[92%] rounded-card-sm border border-line bg-surface p-4">
      {turn.status === "manual" ? <p className="mb-2 text-sm font-[600] text-ink">{t("manualTitle")}</p> : null}
      {savable.length ? <p className="mb-2 text-sm text-muted">{t("found", { count: savable.length })}</p> : null}
      <ul className="space-y-3">
        {ms.map((p, i) => (
          <li key={i} className={cx(savable.length > 1 && "border-b border-line pb-3 last:border-0 last:pb-0")}>
            {p.kind === "answer" ? (
              <p className="whitespace-pre-line text-ink">{p.text}</p>
            ) : p.kind === "tx" ? (
              editing && turn.status === "ready" ? (
                <TxEditor p={p} opts={opts} onChange={(np) => setMain(i, np)} />
              ) : (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 font-[600] text-ink">{p.type === "TRANSFER" ? ttx("transferArrow", { from: accName(p.accountId) ?? "?", to: accName(p.counterAccountId) ?? "?" }) : p.payee ?? ttx(`type.${p.type}`)}</p>
                    <p className={cx("num shrink-0 font-[650]", p.type === "INCOME" ? "text-accent" : "text-ink")}>
                      {p.type === "INCOME" ? "+" : p.type === "EXPENSE" ? "\u2212" : ""}
                      {fmt(p.amount, p.currency)}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.type !== "TRANSFER" ? <Chip>{catName(p.categoryId) ?? ttx("noCategory")}</Chip> : null}
                    <Chip active={!!p.accountId}>{accName(p.accountId) ?? "?"}</Chip>
                    {p.date !== today ? <Chip active={false}>{p.date}</Chip> : null}
                    {p.fxRateIsEstimate ? <Chip active={false}>{t("estimate")}</Chip> : null}
                  </div>
                  {p.interpretedThousands ? <p className="mt-1 text-xs text-muted">{t("readAs", { raw: String(Number(p.amount) / 1000), amount: fmt(p.amount, p.currency) })}</p> : null}
                  {p.originalAmount && p.originalCurrency ? <p className="num mt-1 text-xs text-muted">{fmt(p.originalAmount, p.originalCurrency)}</p> : null}
                </div>
              )
            ) : p.kind === "manual" ? (
              <ManualForm p={p} opts={opts} base={base} today={today} onDone={onCancel} />
            ) : (
              <OtherSummary p={p} fmt={fmt} accName={accName} />
            )}
          </li>
        ))}
      </ul>

      {turn.status === "ready" && open.length ? (
        <div className="mt-3 space-y-3">
          {open.map((q, k) => (
            <fieldset key={k} className="rounded-btn bg-surface-2 p-3">
              <legend className="sr-only">{t("questionPick")}</legend>
              <p className="mb-2 text-sm font-[600] text-ink">{q.question}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <button key={o.label} type="button" className={btn.secondary} onClick={() => answer(q, o.patch)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}

      {turn.error ? (
        <div className="mt-3">
          <Notice tone="warn">{turn.error}</Notice>
        </div>
      ) : null}

      {turn.status === "ready" && savable.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn.primary} onClick={onSave} disabled={incomplete}>
            {t("saveAll")}
          </button>
          {savable.some((p) => p.kind === "tx") ? (
            <button type="button" className={btn.secondary} onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {t("change")}
            </button>
          ) : null}
          <button type="button" className={btn.ghost} onClick={onCancel}>
            {t("cancel")}
          </button>
        </div>
      ) : null}
      {turn.status === "saved" ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-[650] text-accent">
          <Check size={16} strokeWidth={2} aria-hidden />
          {t("saved")}
        </p>
      ) : null}
      {turn.status === "cancelled" ? <p className="mt-3 text-sm text-muted">{t("discarded")}</p> : null}
    </div>
  );
}

function OtherSummary({ p, fmt, accName }: { p: Proposal; fmt: (v: string, c: string) => string; accName: (id?: string | null) => string | undefined }) {
  const t = useTranslations("record");
  const td = useTranslations("debts");
  const head = (k: string, right: string) => (
    <div className="flex items-baseline justify-between gap-3">
      <p className="font-[600] text-ink">{k}</p>
      <p className="num shrink-0 font-[650] text-ink">{right}</p>
    </div>
  );
  switch (p.kind) {
    case "debt":
      return (
        <div>
          {head(`${td(`direction.${p.direction}`)}: ${p.counterparty}`, fmt(p.amount, p.currency))}
          <div className="mt-1.5">
            <Chip active={!!p.accountId}>{accName(p.accountId) ?? "?"}</Chip>
          </div>
        </div>
      );
    case "split":
      return (
        <div>
          {head(`${t("kind.split")}${p.payee ? `: ${p.payee}` : ""}`, fmt(p.total, p.currency))}
          <p className="mt-1 text-sm text-muted">{p.people ? `${p.people}×` : p.counterparties?.join(", ")}</p>
          <div className="mt-1.5">
            <Chip active={!!p.accountId}>{accName(p.accountId) ?? "?"}</Chip>
          </div>
        </div>
      );
    case "trade":
      return head(`${t("kind.trade")}: ${p.side === "BUY" ? "+" : "\u2212"}${p.units} ${p.assetName}`, `@ ${p.unitPrice}`);
    case "balance_check":
      return (
        <div>
          {head(`${t("kind.balance_check")}: ${accName(p.accountId) ?? "?"}`, fmt(p.reported, p.currency))}
          <p className="mt-1 text-sm text-muted">{p.outcome === "MATCH" ? t("balanceMatch") : p.outcome === "SMALL" ? t("balanceSmall") : p.outcome === "LARGE" ? t("balanceLarge") : ""}</p>
        </div>
      );
    case "correct":
      return head(t("kind.correct"), t("correctTo", { before: p.before ?? "?", after: p.after ?? p.value }));
    default:
      return null;
  }
}

function TxEditor({ p, opts, onChange }: { p: Extract<Proposal, { kind: "tx" }>; opts: Opts; onChange: (p: Proposal) => void }) {
  const t = useTranslations("record");
  const ttx = useTranslations("tx");
  const exp = opts.currencies.find((c) => c.code === p.currency)?.exponent ?? 0;
  const [amountText, setAmountText] = useState(minorToInput(p.amount, exp));
  const cls = "min-h-11 w-full rounded-btn border border-line-strong/50 bg-surface px-3 text-base text-ink";
  const changed = (p.categoryId && p.categoryId !== p.suggestedCategoryId) || (p.accountId && p.accountId !== p.suggestedAccountId);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-sm">
        <span className="mb-1 block font-[550] text-ink">{ttx("fields.payee")}</span>
        <input className={cls} value={p.payee ?? ""} onChange={(e) => onChange({ ...p, payee: e.target.value })} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-[550] text-ink">{ttx("fields.amount")}</span>
        <input
          className={cls + " num"}
          inputMode="decimal"
          value={amountText}
          onChange={(e) => {
            setAmountText(e.target.value);
            const m = parseMajor(e.target.value);
            const v = m ? majorStrToMinor(m, exp) : null;
            if (v && v > 0n) onChange({ ...p, amount: v.toString(), interpretedThousands: false });
          }}
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-[550] text-ink">{ttx("fields.account")}</span>
        <select className={cls} value={p.accountId ?? ""} onChange={(e) => onChange({ ...p, accountId: e.target.value || null })}>
          <option value="">?</option>
          {opts.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {p.type !== "TRANSFER" ? (
        <label className="text-sm">
          <span className="mb-1 block font-[550] text-ink">{ttx("fields.category")}</span>
          <select className={cls} value={p.categoryId ?? ""} onChange={(e) => onChange({ ...p, categoryId: e.target.value || null })}>
            <option value="">{ttx("noCategory")}</option>
            {opts.categories
              .filter((c) => c.kind === (p.type === "INCOME" ? "INCOME" : "EXPENSE"))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <label className="text-sm">
        <span className="mb-1 block font-[550] text-ink">{ttx("fields.date")}</span>
        <input type="date" className={cls} value={p.date} onChange={(e) => onChange({ ...p, date: e.target.value })} />
      </label>
      {changed ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={!!p.remember} onChange={(e) => onChange({ ...p, remember: e.target.checked })} />
          {t("remember")}
        </label>
      ) : null}
    </div>
  );
}

function ManualForm({ p, opts, base, today, onDone }: { p: Extract<Proposal, { kind: "manual" }>; opts: Opts; base: string; today: string; onDone: () => void }) {
  // The full transaction form with the amount and the original text prefilled (SPEC 7.7).
  const [TxForm, setTxForm] = useState<null | typeof import("./tx-form").TxForm>(null);
  useEffect(() => {
    void import("./tx-form").then((m) => setTxForm(() => m.TxForm));
  }, []);
  if (!TxForm) return null;
  return <TxForm opts={opts} base={base} today={today} initial={{ amount: p.amount ?? undefined, note: p.note }} onDone={onDone} />;
}
