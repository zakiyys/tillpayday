"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { InputRow } from "@/components/conversation";

/**
 * Input bar on every page (SPEC 10). Sends the text to Record, which runs the parser and shows the card.
 * Hidden on Record itself, which has its own bar inside the conversation.
 */
export function InputBar({ aiState }: { aiState: "off" | "ok" | "down" | "novision" }) {
  const t = useTranslations("record");
  const path = usePathname();
  const router = useRouter();
  const [v, setV] = useState("");
  if (path.startsWith("/record") || path.startsWith("/onboarding") || path.startsWith("/settings")) return null;
  return (
    <form
      className="px-3 pb-2 pt-1 lg:px-0 lg:pb-0 lg:pt-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        router.push(`/record?q=${encodeURIComponent(v.trim())}`);
        setV("");
      }}
      aria-label={t("inputLabel")}
    >
      <InputRow value={v} onChange={setV} onPhoto={() => router.push("/record")} photoDisabled={aiState === "off" || aiState === "novision"} />
      {aiState !== "ok" ? <p className="mt-1 px-3 text-xs text-muted">{aiState === "off" ? t("aiOff") : aiState === "down" ? t("aiDown") : t("noVision")}</p> : null}
    </form>
  );
}
