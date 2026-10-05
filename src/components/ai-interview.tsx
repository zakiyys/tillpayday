"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, PanelRight } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { Draft, Topic, TopicState } from "@/server/onboarding/draft";
import { TextInput, useErrorText } from "./form";
import { Dialog } from "./dialog";
import { Wizard } from "./wizard";
import { btn, Card, Notice, cx } from "./ui";
import { useReauth } from "./auth/reauth";

interface State {
  data: Draft;
  topics: TopicState;
  current: Topic | null;
  question: string | null;
  transcript: Array<{ role: "app" | "user"; text: string }>;
  notice?: "secret_refused" | "not_understood" | null;
}

const TOPICS: Topic[] = ["basics", "payday", "accounts", "wallets", "debts", "assets", "bills", "goals"];

/**
 * AI onboarding (SPEC 9.3): connect and test, consent, then one question per turn with the draft beside it.
 * Switching to the form is possible at any time and continues from the same draft.
 */
export function AiInterview({ hasConfig, consented, endpoint, currencies, assetTypes, onManual }: { hasConfig: boolean; consented: boolean; endpoint: string | null; currencies: Array<{ code: string; exponent: number }>; assetTypes: Array<{ key: string; name: string }>; onManual: () => void }) {
  const t = useTranslations("onboarding");
  const ta = useTranslations("ai");
  const errText = useErrorText("onboarding");
  const reauth = useReauth();
  const [step, setStep] = useState<"connect" | "consent" | "chat" | "manual">(hasConfig ? (consented ? "chat" : "consent") : "connect");
  const [ep, setEp] = useState(endpoint);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(false);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "chat" && !state) void api<State>("/api/v1/onboarding/interview").then(setState).catch((e) => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [state?.transcript?.length]);

  if (step === "manual") {
    // Same draft, same point: the form picks up whatever the interview filled in.
    if (state) return <Wizard initial={state.data} topics={state.topics} currencies={currencies} assetTypes={assetTypes} />;
    return (
      <button type="button" className={btn.primary} onClick={onManual}>
        {t("switchToManual")}
      </button>
    );
  }

  if (step === "connect")
    return (
      <Card className="max-w-xl space-y-4 p-5">
        <h2 className="text-lg font-[650] text-ink">{t("aiSetupTitle")}</h2>
        <p className="text-sm text-muted">{t("aiSetupBody")}</p>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            try {
              await reauth(() => api("/api/v1/ai-config", { method: "PUT", body: { endpoint: f.get("endpoint"), model: f.get("model"), apiKey: String(f.get("apiKey") ?? "") || undefined } }));
              const r = await api<{ capabilities: { ok?: boolean } }>("/api/v1/ai-config/test", { body: {} });
              if (!r.capabilities.ok) setError(t("aiTestFailed"));
              else {
                setEp(String(f.get("endpoint")));
                setStep("consent");
              }
            } catch (err) {
              setError(errText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextInput label={ta("endpoint")} help={ta("endpointHelp")} name="endpoint" type="url" required />
          <TextInput label={ta("model")} name="model" required />
          <TextInput label={ta("apiKey")} name="apiKey" type="password" autoComplete="off" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={btn.primary} disabled={busy}>
              {t("aiTest")}
            </button>
            <button type="button" className={btn.ghost} onClick={onManual}>
              {t("switchToManual")}
            </button>
          </div>
        </form>
      </Card>
    );

  if (step === "consent")
    return (
      <Card className="max-w-xl space-y-4 p-5">
        <h2 className="text-lg font-[650] text-ink">{t("consentTitle")}</h2>
        <p className="text-sm text-ink">{t("consentBody", { endpoint: ep ?? "" })}</p>
        <p className="text-sm text-muted">{ta("sentBody")}</p>
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn.primary}
            onClick={async () => {
              try {
                await api("/api/v1/ai-config/consent", { body: {} });
                setStep("chat");
              } catch (e) {
                setError(errText(e));
              }
            }}
          >
            {t("consentAgree")}
          </button>
          <button type="button" className={btn.ghost} onClick={onManual}>
            {t("switchToManual")}
          </button>
        </div>
      </Card>
    );

  const send = async (v: string) => {
    if (!v.trim() || !state) return;
    setBusy(true);
    setError(null);
    try {
      setState(await api<State>("/api/v1/onboarding/interview", { body: { text: v } }));
      setText("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "ai_unavailable") setError(t("aiUnavailable"));
      else setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const progress = (
    <ol className="space-y-1" aria-label={t("title")}>
      {TOPICS.map((k) => (
        <li key={k} className={cx("flex min-h-9 items-center gap-2 text-sm", state?.current === k ? "font-[650] text-ink" : "text-muted")} aria-current={state?.current === k ? "step" : undefined}>
          <span className={cx("grid size-5 place-items-center rounded-full border", state?.topics[k] === "done" ? "border-accent bg-accent text-on-accent" : "border-line-strong/60")}>{state?.topics[k] === "done" ? <Check size={12} strokeWidth={2.5} aria-hidden /> : null}</span>
          {t(`topics.${k}`)}
          <span className="sr-only">({state ? t(`status.${state.topics[k]}`) : ""})</span>
        </li>
      ))}
    </ol>
  );
  const draftView = state ? (
    <div className="space-y-3 text-sm">
      {progress}
      <div className="border-t border-line pt-3">
        <p className="text-xs font-[600] uppercase tracking-[0.04em] text-muted">{t("draftPanel")}</p>
        <ul className="mt-1 space-y-0.5 text-ink">
          <li>
            {state.data.basics.baseCurrency} · {state.data.basics.timezone}
          </li>
          {state.data.accounts.map((a, i) => (
            <li key={i}>
              {a.name} · {a.type}
            </li>
          ))}
          {state.data.bills.map((b, i) => (
            <li key={`b${i}`}>{b.name}</li>
          ))}
          {state.data.goals.map((g, i) => (
            <li key={`g${i}`}>{g.name}</li>
          ))}
        </ul>
      </div>
      <button type="button" className={btn.secondary + " w-full"} onClick={() => setStep("manual")}>
        {t("switchToManual")}
      </button>
    </div>
  ) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3">
        <div className="flex justify-end lg:hidden">
          <button type="button" className={btn.secondary} onClick={() => setPanel(true)}>
            <PanelRight size={18} strokeWidth={1.75} aria-hidden />
            {t("draftPanel")}
          </button>
        </div>
        <ol className="space-y-2" aria-live="polite">
          {(state?.transcript ?? []).map((m, i) => (
            <li key={i} className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <p className={cx("max-w-[85%] px-4 py-2.5", m.role === "user" ? "rounded-[18px] rounded-br-md bg-accent text-on-accent" : "rounded-card-sm border border-line bg-surface text-ink")}>{m.text}</p>
            </li>
          ))}
          {state?.question ? (
            <li className="flex justify-start">
              <p className="max-w-[85%] rounded-card-sm border border-line bg-surface px-4 py-2.5 font-[550] text-ink">{state.question}</p>
            </li>
          ) : null}
        </ol>
        <div ref={end} />
        {state?.notice === "secret_refused" ? <Notice tone="warn">{t("secretRefused")}</Notice> : null}
        {state?.notice === "not_understood" ? <Notice>{t("notUnderstood")}</Notice> : null}
        {error ? (
          <div className="space-y-2">
            <Notice tone="warn">{error}</Notice>
            <button type="button" className={btn.secondary} onClick={() => setStep("manual")}>
              {t("switchToManual")}
            </button>
          </div>
        ) : null}
        {state && !state.current ? (
          <Card className="space-y-3">
            <p className="text-ink">{t("done")}</p>
            <button type="button" className={btn.primary} onClick={() => setStep("manual")}>
              {t("toSummary")}
            </button>
          </Card>
        ) : state ? (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-[550] text-ink">{t("answerLabel")}</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-btn border border-line-strong/50 bg-surface px-3 py-2 text-base text-ink" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btn.primary} disabled={busy || !text.trim()}>
                {t("sendAnswer")}
              </button>
              <button type="button" className={btn.ghost} disabled={busy} onClick={() => send("skip")}>
                {t("skipTopic")}
              </button>
            </div>
          </form>
        ) : null}
      </div>
      <aside className="hidden lg:block">
        <Card>{draftView}</Card>
      </aside>
      <Dialog open={panel} onClose={() => setPanel(false)} title={t("draftPanel")}>
        {draftView}
      </Dialog>
    </div>
  );
}
