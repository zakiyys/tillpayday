"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

/**
 * Native <dialog>: focus trap, Escape to close and inert background come from the platform.
 * On phones it docks to the bottom as a sheet; on wide screens it is centred.
 */
export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const tc = useTranslations("common");
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[20px] border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-black/40 " +
        (wide ? "md:m-auto md:max-w-2xl md:rounded-card" : "md:m-auto md:max-w-lg md:rounded-card")
      }
    >
      {open ? (
        <>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3">
            <h2 className="text-lg font-[650]">{title}</h2>
            <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-btn hover:bg-surface-2" aria-label={tc("close")}>
              <X size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="safe-bottom px-5 pb-5 pt-4">{children}</div>
        </>
      ) : null}
    </dialog>
  );
}
