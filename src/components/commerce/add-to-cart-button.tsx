"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCart, type CartLine } from "@/lib/client/cart-store";
import { track } from "@/lib/client/pixel";
import { Icon } from "@/components/icons/icon";

export function AddToCartButton({
  line,
  packs = 1,
  size = "full",
  label = "Add to Cart",
  className,
}: {
  line: Omit<CartLine, "packs">;
  packs?: number;
  size?: "full" | "compact";
  label?: string;
  className?: string;
}) {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  const onClick = () => {
    add({ ...line, packs });
    track("AddToCart", {
      content_ids: [line.productId],
      content_type: "product",
      value: (line.unitPriceKobo * packs) / 100,
      currency: "NGN",
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  if (size === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "min-h-11 shrink-0 rounded-lg bg-surface-high px-3 text-label-sm font-bold text-navy transition-colors hover:bg-navy hover:text-on-dark",
          added && "bg-emerald-ink text-on-dark",
          className,
        )}
        aria-label={`Add ${line.name} to cart`}
      >
        {added ? "Added ✓" : "Add"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-navy bg-card px-4 text-label-lg font-bold text-navy transition-colors hover:bg-surface-container",
        added && "border-emerald-ink bg-emerald-soft text-emerald-ink",
        className,
      )}
    >
      <Icon name={added ? "check_circle" : "shopping_bag"} />
      <span aria-live="polite">{added ? "Added to cart" : label}</span>
    </button>
  );
}
