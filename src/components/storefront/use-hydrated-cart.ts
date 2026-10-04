"use client";

import { useSyncExternalStore } from "react";
import { useCart, type CartLine } from "@/lib/client/cart-store";

const noop = () => () => {};

/** Cart lines once the persisted (localStorage) cart is available; `ready` is false during SSR/hydration. */
export function useHydratedCart(): { ready: boolean; lines: CartLine[] } {
  const lines = useCart((s) => s.lines);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  return { ready, lines: ready ? lines : [] };
}
