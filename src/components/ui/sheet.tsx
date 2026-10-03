"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Bottom sheet on mobile, centred modal on desktop. Built on native <dialog> for focus trapping,
 * Esc-to-close and inert background without shipping a dialog library.
 */
export function Sheet({ open, onClose, title, description, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onClose={() => {
        document.documentElement.style.overflow = "";
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "m-0 mt-auto w-full max-w-none rounded-t-2xl bg-card p-0 text-ink shadow-float backdrop:bg-navy-deep/60 backdrop:backdrop-blur-[2px]",
        "max-h-[92dvh] sm:m-auto sm:max-w-lg sm:rounded-2xl",
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line-soft bg-card px-4 pt-3 pb-3">
        <div className="min-w-0">
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-surface-dim sm:hidden" />
          <h2 id="sheet-title" className="font-display text-headline-sm text-navy">
            {title}
          </h2>
          {description ? <p className="text-body-sm text-ink-muted">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-container"
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="overflow-y-auto px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
