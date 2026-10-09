import { Banknote, CreditCard, HandCoins, Landmark, ReceiptText, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { GLYPHS } from "@/lib/brand-glyphs";
import { findInstitution, type Institution } from "@/lib/institutions";
import { cx } from "./ui";

const TYPE_ICON: Record<string, LucideIcon> = {
  BANK: Landmark,
  EWALLET: Wallet,
  CASH: Banknote,
  INVESTMENT: TrendingUp,
  CREDIT_CARD: CreditCard,
  PAYLATER: ReceiptText,
  LOAN: Landmark,
  RECEIVABLE: HandCoins,
  PERSONAL_DEBT: HandCoins,
};

/** The brand tile for one institution: its glyph or monogram on the brand colour. */
export function InstitutionMark({ inst, size = 40, className }: { inst: Institution; size?: number; className?: string }) {
  const ink = inst.ink ?? "#FFFFFF";
  const glyph = inst.glyph ? GLYPHS[inst.glyph] : undefined;
  const mono = inst.mono ?? inst.name.slice(0, 2);
  // Monograms shrink with their length so "CIMB" fits as well as "J".
  const fs = size * (mono.length <= 1 ? 0.5 : mono.length === 2 ? 0.4 : mono.length === 3 ? 0.31 : 0.26);
  return (
    <span
      aria-hidden
      className={cx("inline-grid shrink-0 place-items-center overflow-hidden rounded-[30%] font-[750] leading-none tracking-[-0.02em] ring-1 ring-black/5", className)}
      style={{ width: size, height: size, background: inst.color, color: ink, fontSize: fs }}
    >
      {glyph ? (
        <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill={ink}>
          <path d={glyph} />
        </svg>
      ) : (
        mono
      )}
    </span>
  );
}

/**
 * Mark for an account: the institution's brand tile when the institution or the account name names a known one,
 * otherwise an icon for the account type. Decorative; the account name is always written next to it.
 */
export function AccountLogo({ type, institution, name, size = 40, className }: { type: string; institution?: string | null; name?: string | null; size?: number; className?: string }) {
  const inst = type === "CASH" || type === "RECEIVABLE" || type === "PERSONAL_DEBT" ? null : findInstitution(institution, name);
  if (inst) return <InstitutionMark inst={inst} size={size} className={className} />;
  const Icon = TYPE_ICON[type] ?? Wallet;
  return (
    <span aria-hidden className={cx("inline-grid shrink-0 place-items-center rounded-[30%] bg-accent-soft text-on-accent-soft", className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} strokeWidth={1.75} />
    </span>
  );
}
