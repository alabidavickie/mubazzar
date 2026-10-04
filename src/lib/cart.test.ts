import { describe, expect, it } from "vitest";
import { MAX_CART_LINES, mergeCartItems } from "./cart";

const a = "00000000-0000-4000-8000-00000000000a";
const b = "00000000-0000-4000-8000-00000000000b";
const bundle = "00000000-0000-4000-8000-0000000000b1";

describe("mergeCartItems", () => {
  it("keeps lines from both carts and the larger pack count for shared lines (no doubling)", () => {
    const merged = mergeCartItems(
      [{ productId: a, bundleId: null, packs: 2 }],
      [
        { productId: a, bundleId: null, packs: 1 },
        { productId: a, bundleId: bundle, packs: 3 },
        { productId: b, bundleId: null, packs: 1 },
      ],
    );
    expect(merged).toEqual([
      { productId: a, bundleId: null, packs: 2 },
      { productId: a, bundleId: bundle, packs: 3 },
      { productId: b, bundleId: null, packs: 1 },
    ]);
  });

  it("clamps pack counts and the number of lines", () => {
    expect(mergeCartItems([{ productId: a, bundleId: null, packs: 99 }], [])[0]!.packs).toBe(20);
    expect(mergeCartItems([{ productId: a, bundleId: null, packs: 0 }], [])[0]!.packs).toBe(1);
    const many = Array.from({ length: 30 }, (_, i) => ({ productId: `${a.slice(0, -2)}${String(i).padStart(2, "0")}`, bundleId: null, packs: 1 }));
    expect(mergeCartItems(many, many)).toHaveLength(MAX_CART_LINES);
  });

  it("returns an empty cart when both are empty", () => {
    expect(mergeCartItems([], [])).toEqual([]);
  });
});
