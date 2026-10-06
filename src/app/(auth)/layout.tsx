import { getTranslations } from "next-intl/server";
import { LogoLockup } from "@/components/brand/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <LogoLockup name={process.env.APP_NAME ?? "TillPayDay"} size={32} className="mb-6" />
      {children}
      <p className="mt-10 text-xs text-muted">{t("tagline")}</p>
    </main>
  );
}
