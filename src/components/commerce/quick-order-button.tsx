"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/icons/icon";

// The sheet + order form are only downloaded when a shopper taps the button.
const QuickOrderSheet = dynamic(() => import("@/components/order/quick-order-sheet").then((m) => m.QuickOrderSheet), {
  ssr: false,
});

export function QuickOrderButton({
  productId,
  productName,
  label = "Quick Order",
  icon = "shopping_cart_checkout",
  disabled,
  className,
}: {
  productId: string;
  productName: string;
  label?: string;
  icon?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        aria-label={`${label}: ${productName}`}
        className={cn(
          "flex h-11 w-full items-center justify-center gap-1 rounded-lg bg-navy text-label-md font-bold text-on-dark shadow-card transition active:scale-95 disabled:opacity-50",
          className,
        )}
      >
        <Icon name={icon} className="text-base" />
        <span>{label}</span>
      </button>
      {mounted ? <QuickOrderSheet productId={productId} open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
