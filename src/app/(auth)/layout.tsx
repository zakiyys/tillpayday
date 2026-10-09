import { getTranslations } from "next-intl/server";
import { LogoLockup } from "@/components/brand/logo";

// A still row of the day cups, as on Home: the first days used, today lit, the rest still full. Decorative.
const CUPS = [0.3, 0.75, 0.1, 0.55, 0.9, 0.4, 1, 1, 1, 1, 1, 1, 1, 1];
const VESSEL = "M1 2.2 Q1 1 2.2 1 H9.8 Q11 1 11 2.2 L10.4 12.6 Q10 16.8 6 17 Q2 16.8 1.6 12.6 Z";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  const name = process.env.APP_NAME ?? "TillPayDay";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="on-hero glaze flex flex-col justify-between gap-8 px-6 pb-8 pt-8 text-on-hero lg:min-h-dvh lg:px-14 lg:py-14">
        <LogoLockup name={name} size={32} onHero />
        <div className="max-w-md">
          <p className="text-[1.75rem] font-[750] leading-tight tracking-[-0.025em] lg:text-[2.5rem]">{t("authTitle")}</p>
          <p className="mt-3 text-on-hero-muted">{t("authBody")}</p>
          <div aria-hidden className="mt-7 flex max-w-sm items-end gap-1.5">
            {CUPS.map((f, i) => (
              <svg key={i} viewBox="0 0 12 18" className="w-full max-w-6 overflow-visible">
                <clipPath id={`a-${i}`}>
                  <path d={VESSEL} />
                </clipPath>
                <path d={VESSEL} className="fill-on-hero/12" />
                <rect x="0" width="12" y={18 - 17 * f} height={17 * f} clipPath={`url(#a-${i})`} className={i === 5 ? "fill-ochre" : i > 5 ? "fill-on-hero/22" : "fill-on-hero"} />
                <path d={VESSEL} fill="none" strokeWidth={i === 5 ? 1.6 : 1} strokeDasharray={i > 5 ? "1.6 1.4" : undefined} className={i === 5 ? "stroke-ochre" : "stroke-on-hero/45"} />
              </svg>
            ))}
          </div>
        </div>
        <p className="hidden text-sm text-on-hero-muted lg:block">{t("tagline")}</p>
      </aside>
      <main id="main" className="mx-auto flex w-full max-w-md flex-col justify-center px-5 py-10 lg:py-14">
        {children}
      </main>
    </div>
  );
}
