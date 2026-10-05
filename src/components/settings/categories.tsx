"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Checkbox, Select, TextInput, useErrorText } from "@/components/form";
import { Dialog } from "@/components/dialog";
import { btn, Card, Chip, Notice, SectionTitle } from "@/components/ui";

interface Cat {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  countsToPool: boolean;
  used: number;
}

export function CategorySettings({ cats, rules }: { cats: Cat[]; rules: Array<{ id: string; match: string; target: string }> }) {
  const t = useTranslations("cats");
  const tc = useTranslations("common");
  const errText = useErrorText("cats");
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [merge, setMerge] = useState<Cat | null>(null);
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const run = async (fn: () => Promise<unknown>) => {
    setMsg(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setMsg(errText(e));
    }
  };
  return (
    <div className="max-w-3xl space-y-2">
      {msg ? <Notice tone="warn">{msg}</Notice> : null}
      <Card>
        <form
          className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const form = e.currentTarget;
            void run(() => api("/api/v1/categories", { body: { name: f.get("name"), kind, countsToPool: f.get("pool") === "on" } })).then(() => form.reset());
          }}
        >
          <TextInput label={t("name")} name="name" required maxLength={60} />
          <Select label={t("kind")} value={kind} onChange={(e) => setKind(e.target.value as "EXPENSE")}>
            <option value="EXPENSE">{t("EXPENSE")}</option>
            <option value="INCOME">{t("INCOME")}</option>
          </Select>
          <button type="submit" className={btn.primary}>
            {t("add")}
          </button>
          {kind === "INCOME" ? (
            <div className="md:col-span-3">
              <Checkbox label={t("countsToPool")} help={t("countsHelp")} name="pool" />
            </div>
          ) : null}
        </form>
      </Card>
      {(["EXPENSE", "INCOME"] as const).map((k) => (
        <section key={k}>
          <SectionTitle>{t(k)}</SectionTitle>
          <Card flush>
            <ul className="divide-y divide-line">
              {cats
                .filter((c) => c.kind === k)
                .map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                    <form
                      className="flex min-w-0 flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = String(new FormData(e.currentTarget).get("n") ?? "");
                        if (name && name !== c.name) void run(() => api(`/api/v1/categories/${c.id}`, { method: "PATCH", body: { name } }));
                      }}
                    >
                      <label className="min-w-0 flex-1">
                        <span className="sr-only">
                          {t("rename")}: {c.name}
                        </span>
                        <input name="n" defaultValue={c.name} maxLength={60} className="min-h-11 w-full rounded-btn border border-transparent bg-transparent px-2 text-ink hover:border-line focus-visible:border-accent" />
                      </label>
                      {c.countsToPool ? <Chip>{t("countsToPool")}</Chip> : null}
                      <span className="num shrink-0 text-xs text-muted">{c.used}</span>
                    </form>
                    <button type="button" className={btn.ghost} onClick={() => setMerge(c)}>
                      {t("merge")}
                    </button>
                    {c.used === 0 ? (
                      <button type="button" className="grid size-11 place-items-center rounded-btn text-muted hover:bg-surface-2" aria-label={`${t("delete")}: ${c.name}`} onClick={() => run(() => api(`/api/v1/categories/${c.id}`, { method: "DELETE" }))}>
                        <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))}
            </ul>
          </Card>
        </section>
      ))}
      <SectionTitle>{t("rules")}</SectionTitle>
      <p className="mb-2 text-sm text-muted">{t("rulesBody")}</p>
      <Card flush>
        {rules.length ? (
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-ink">{t("ruleTo", { match: r.match, target: r.target })}</span>
                <button type="button" className="grid size-11 place-items-center rounded-btn text-muted hover:bg-surface-2" aria-label={`${tc("delete")}: ${r.match}`} onClick={() => run(() => api(`/api/v1/rules/${r.id}`, { method: "DELETE" }))}>
                  <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">{t("noRules")}</p>
        )}
      </Card>
      <Dialog open={!!merge} onClose={() => setMerge(null)} title={merge ? t("mergeTitle", { name: merge.name }) : ""}>
        {merge ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const into = String(new FormData(e.currentTarget).get("into"));
              void run(() => api(`/api/v1/categories/${merge.id}/merge`, { body: { intoId: into } })).then(() => setMerge(null));
            }}
          >
            <p className="text-sm text-muted">{t("mergeBody")}</p>
            <Select label={t("merge")} name="into">
              {cats
                .filter((c) => c.kind === merge.kind && c.id !== merge.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <button type="submit" className={btn.primary + " w-full"}>
              {t("merge")}
            </button>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}
