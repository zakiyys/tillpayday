import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ownerExists } from "@/server/auth/setup";
import { SetupForm } from "@/components/auth/setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await ownerExists()) redirect("/login");
  const t = await getTranslations("auth");
  return (
    <>
      <h1 className="text-2xl font-[650] tracking-[-0.01em] text-ink">{t("setupTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("setupBody")}</p>
      <SetupForm />
    </>
  );
}
