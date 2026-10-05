import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-xl font-[650] text-ink">{t("notFound")}</h1>
      <p className="mt-2 text-sm text-muted">{t("notFoundBody")}</p>
      <Link href="/" className="press mt-6 inline-flex min-h-11 items-center rounded-btn bg-accent px-4 text-sm font-[600] text-on-accent">
        {t("goHome")}
      </Link>
    </main>
  );
}
