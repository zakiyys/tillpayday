import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { requirePage } from "@/server/context";
import { getAiConfigView } from "@/server/ai/provider";
import { PageHeader } from "@/components/ui";
import { AiSettings } from "@/components/settings/ai";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const ctx = await requirePage({ allowUnfinished: true });
  const t = await getTranslations("ai");
  const ts = await getTranslations("settings");
  return (
    <>
      <Link href="/settings" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-[600] text-muted hover:text-ink">
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        {ts("title")}
      </Link>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <AiSettings config={await getAiConfigView(ctx.householdId)} isOwner={ctx.role === "OWNER"} />
    </>
  );
}
