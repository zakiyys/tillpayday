"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, ClipboardList, FlaskConical } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Draft, TopicState } from "@/server/onboarding/draft";
import { Wizard } from "./wizard";
import { useErrorText } from "./form";
import { Notice } from "./ui";

function Option({ icon: Icon, title, body, onClick }: { icon: typeof Bot; title: string; body: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-start gap-4 rounded-card-sm border border-line bg-surface p-5 text-left hover:border-accent">
      <Icon size={24} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-accent" />
      <span>
        <span className="block font-[650] text-ink">{title}</span>
        <span className="mt-1 block text-sm text-muted">{body}</span>
      </span>
    </button>
  );
}

export function OnboardingFlow(p: {
  draft: Draft;
  topics: TopicState;
  started: boolean;
  path: "MANUAL" | "AI";
  currencies: Array<{ code: string; exponent: number }>;
  assetTypes: Array<{ key: string; name: string }>;
  aiSlot?: React.ReactNode;
}) {
  const t = useTranslations("onboarding");
  const errText = useErrorText("onboarding");
  const [mode, setMode] = useState<"choose" | "MANUAL" | "AI">(p.started ? p.path : "choose");
  const [error, setError] = useState<string | null>(null);

  if (mode === "MANUAL") return <Wizard initial={p.draft} topics={p.topics} currencies={p.currencies} assetTypes={p.assetTypes} onSwitchToAi={p.aiSlot ? () => setMode("AI") : undefined} />;
  if (mode === "AI" && p.aiSlot) return <>{p.aiSlot}</>;

  const demo = async () => {
    if (!window.confirm(t("demoConfirm"))) return;
    setError(null);
    try {
      await api("/api/v1/onboarding/demo", { body: {} });
      window.location.assign("/");
    } catch (e) {
      setError(errText(e));
    }
  };
  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-lg font-[650] text-ink">{t("chooseTitle")}</h2>
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Option icon={ClipboardList} title={t("manual")} body={t("manualBody")} onClick={() => setMode("MANUAL")} />
      {p.aiSlot ? <Option icon={Bot} title={t("ai")} body={t("aiBody")} onClick={() => setMode("AI")} /> : null}
      <Option icon={FlaskConical} title={t("demo")} body={t("demoBody")} onClick={demo} />
    </div>
  );
}
