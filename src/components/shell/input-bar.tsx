"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { InputRow } from "@/components/conversation";
import { holdPhoto } from "@/lib/pending-photo";

/**
 * Input bar on every page (SPEC 10). Sends the text to Record, which runs the parser and shows the card.
 * Hidden on Record itself, which has its own bar inside the conversation, and on phones outside Home.
 */
export function InputBar({ aiState, placement }: { aiState: "off" | "ok" | "down" | "novision"; placement: "mobile" | "desktop" }) {
  const t = useTranslations("record");
  const path = usePathname();
  const router = useRouter();
  const [v, setV] = useState("");
  const file = useRef<HTMLInputElement>(null);
  if (path.startsWith("/record") || path.startsWith("/onboarding") || path.startsWith("/settings")) return null;
  // On phones the bar lives on Home only; every other page reaches it through the raised Record button.
  if (placement === "mobile" && path !== "/") return null;
  return (
    <form
      className="border-t border-line/60 bg-canvas/95 px-3 pb-2 pt-2 backdrop-blur lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        router.push(`/record?q=${encodeURIComponent(v.trim())}`);
        setV("");
      }}
      aria-label={t("inputLabel")}
    >
      <InputRow value={v} onChange={setV} onPhoto={() => file.current?.click()} onChat={() => router.push("/record")} photoDisabled={aiState === "off" || aiState === "novision"} />
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
          if (!f) return;
          holdPhoto(f);
          router.push("/record");
        }}
      />
      {aiState !== "ok" ? <p className="mt-1 px-3 text-xs text-muted">{aiState === "off" ? t("aiOff") : aiState === "down" ? t("aiDown") : t("noVision")}</p> : null}
    </form>
  );
}
