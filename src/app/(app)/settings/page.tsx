import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { requirePage } from "@/server/context";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const SECTIONS = ["household", "security", "tokens", "ai", "currencies", "categories", "notifications", "data", "appearance"] as const;

export default async function SettingsPage() {
  await requirePage({ allowUnfinished: true });
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} />
      <Card flush className="max-w-2xl">
        <ul className="divide-y divide-line">
          {SECTIONS.map((s) => (
            <li key={s}>
              <Link href={`/settings/${s}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <p className="font-[600] text-ink">{t(`sections.${s}`)}</p>
                  <p className="text-sm text-muted">{t(`sections.${s}Body`)}</p>
                </div>
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
