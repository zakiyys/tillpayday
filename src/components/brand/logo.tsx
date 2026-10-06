// Brand mark and lockup. The shape itself lives in public/logo.svg (5 bars) and public/logo-small.svg
// (3 bars): the markup never redraws it, it only masks the file with the current colour, so the SVG stays
// the single source and the mark always follows the accent the user picked.
import type { CSSProperties } from "react";
import { cx } from "@/components/ui";

// Cap-height of Plus Jakarta Sans is 745/1000 em, so this font size puts the capitals at 45% of the icon.
const WORDMARK_EM = 0.45 / 0.745;
// Distance from icon to name: 25% of the icon height.
const GAP = 0.25;

/** The mark alone, in `currentColor`. 24 px and below uses the small three-bar form to stay sharp. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  const src = size <= 24 ? "/logo-small.svg" : "/logo.svg";
  const mask: CSSProperties = {
    width: size,
    height: size,
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
  return <span aria-hidden className={cx("inline-block shrink-0 bg-current", className)} style={mask} />;
}

/** The app icon: rounded tile (22.5% of the side) in the accent, mark in the accent's text colour at 72%. */
export function AppIcon({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-grid shrink-0 place-items-center bg-accent text-on-accent", className)}
      style={{ width: size, height: size, borderRadius: size * 0.225 }}
    >
      <LogoMark size={size * 0.72} className="text-current" />
    </span>
  );
}

/**
 * Icon plus the app name. The name comes from APP_NAME, never a hard-coded string.
 * Cap height is ~45% of the icon; the gap between them is 25% of the icon.
 */
export function LogoLockup({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  return (
    <span className={cx("inline-flex items-center", className)} style={{ gap: size * GAP }}>
      <AppIcon size={size} />
      <span
        className="font-[800] leading-none tracking-[-0.02em] text-ink"
        style={{ fontSize: size * WORDMARK_EM }}
      >
        {name}
      </span>
    </span>
  );
}
