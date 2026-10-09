import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bell, ChevronRight, Coins, DatabaseBackup, KeyRound, Palette, ShieldCheck, Sparkles, Tags, Users, type LucideIcon } from "lucide-react";
import { requirePage } from "@/server/context";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

// Settings grouped by what people come here to do: run the household, keep it safe, connect things, own the data.
const GROUPS: Array<{ key: string; items: Array<[string, LucideIcon]> }> = [
  { key: "groupHousehold", items: [["household", Users], ["categories", Tags], ["currencies", Coins], ["notifications", Bell]] },
  { key: "groupSecurity", items: [["security", ShieldCheck], ["appearance", Palette]] },
  { key: "groupConnect", items: [["ai", Sparkles], ["tokens", KeyRound]] },
  { key: "groupData", items: [["data", DatabaseBackup]] },
];

export default async function SettingsPage() {
  await requirePage({ allowUnfinished: true });
  const t = await getTranslations("settings");
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {GROUPS.map((g, i) => (
        <section key={g.key} aria-labelledby={`sg-${g.key}`}>
          {i === 0 ? <h2 id={`sg-${g.key}`} className="sr-only">{t(g.key)}</h2> : null}
          {i > 0 ? (
            <SectionTitle>
              <span id={`sg-${g.key}`}>{t(g.key)}</span>
            </SectionTitle>
          ) : null}
          <Card flush>
            <ul className="divide-y divide-line">
              {g.items.map(([s, Icon]) => (
                <li key={s}>
                  <Link href={`/settings/${s}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-btn bg-accent-soft text-on-accent-soft">
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-[650] text-ink">{t(`sections.${s}`)}</p>
                      <p className="text-sm text-muted">{t(`sections.${s}Body`)}</p>
                    </div>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
