"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MAX_CART_LINES, MAX_PACKS } from "@/lib/cart";

/**
 * Cart (persisted to localStorage; mirrored to the account's server cart by <CartSync> when a customer is signed in).
 * Prices here are for display; the server recomputes everything at checkout.
 */
export interface CartLine {
  productId: string;
  bundleId: string | null;
  packs: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  bundleLabel: string | null;
  unitPriceKobo: number;
  compareAtKobo: number | null;
  giftName: string | null;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, "packs"> & { packs?: number }) => void;
  setPacks: (productId: string, bundleId: string | null, packs: number) => void;
  remove: (productId: string, bundleId: string | null) => void;
  clear: () => void;
  replace: (lines: CartLine[]) => void;
}

const same = (a: { productId: string; bundleId: string | null }, b: { productId: string; bundleId: string | null }) =>
  a.productId === b.productId && (a.bundleId ?? null) === (b.bundleId ?? null);

export { MAX_PACKS };

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((s) => {
          const packs = line.packs ?? 1;
          const existing = s.lines.find((l) => same(l, line));
          if (existing) {
            return {
              lines: s.lines.map((l) => (same(l, line) ? { ...l, packs: Math.min(MAX_PACKS, l.packs + packs) } : l)),
            };
          }
          return { lines: [...s.lines, { ...line, packs: Math.min(MAX_PACKS, packs) }].slice(0, MAX_CART_LINES) };
        }),
      setPacks: (productId, bundleId, packs) =>
        set((s) => ({
          lines:
            packs <= 0
              ? s.lines.filter((l) => !same(l, { productId, bundleId }))
              : s.lines.map((l) => (same(l, { productId, bundleId }) ? { ...l, packs: Math.min(MAX_PACKS, packs) } : l)),
        })),
      remove: (productId, bundleId) => set((s) => ({ lines: s.lines.filter((l) => !same(l, { productId, bundleId })) })),
      clear: () => set({ lines: [] }),
      replace: (lines) => set({ lines }),
    }),
    { name: "mbz-cart", version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.packs, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.unitPriceKobo * l.packs, 0);
}
