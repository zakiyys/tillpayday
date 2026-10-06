import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

const name = process.env.APP_NAME ?? "Home Ledger";

// The <title> is rendered in <head> directly (below), not through metadata: production streams metadata after the
// shell, and the document must have a title from the first byte (WCAG 2.4.2).
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  applicationName: name,
  appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1513" },
  ],
};

// Resolves "system" before first paint so dark mode never flashes light.
const themeScript = `(()=>{try{var d=document.documentElement;if(d.dataset.theme==="system"){d.dataset.theme=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const jar = await cookies();
  const theme = jar.get("theme")?.value;
  const accent = jar.get("accent")?.value;
  return (
    <html
      lang={locale}
      data-theme={theme === "dark" || theme === "light" ? theme : "system"}
      data-accent={accent && ["slate", "plum", "graphite"].includes(accent) ? accent : undefined}
      suppressHydrationWarning
    >
      <head>
        <title>{name}</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
