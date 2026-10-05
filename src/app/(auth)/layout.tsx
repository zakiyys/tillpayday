import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="mb-6 text-sm font-[650] tracking-[-0.01em] text-accent">{process.env.APP_NAME ?? "Home Ledger"}</p>
      {children}
      <p className="mt-10 text-xs text-muted">{t("tagline")}</p>
    </main>
  );
}
