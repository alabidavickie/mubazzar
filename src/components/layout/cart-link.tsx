"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons/icon";
import { cartCount, useCart } from "@/lib/client/cart-store";

const subscribeHydration = () => () => {};

export function CartLink() {
  const lines = useCart((s) => s.lines);
  // Avoid hydration mismatch: the persisted cart only exists in the browser.
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const count = hydrated ? cartCount(lines) : 0;
  return (
    <Link
      href="/cart"
      aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="relative flex size-11 items-center justify-center text-ink hover:text-navy"
    >
      <Icon name="shopping_bag" />
      {count > 0 ? (
        <span
          data-testid="cart-count"
          className="absolute top-1 right-1 flex size-4.5 items-center justify-center rounded-full bg-gold-soft text-[0.625rem] font-extrabold text-bronze-ink shadow-card"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
