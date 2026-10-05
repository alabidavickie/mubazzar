import { describe, expect, it } from "vitest";
import { productInput } from "./product";

const base = { name: "Turbo Car Vacuum", slug: "turbo-car-vacuum", price: "19,500" };

describe("productInput", () => {
  it("converts naira text to kobo and normalises optional fields", () => {
    const p = productInput.parse({ ...base, compareAt: "₦24,500", tags: "Car, vacuum, car ,", shortDescription: "  " });
    expect(p.price).toBe(1_950_000);
    expect(p.compareAt).toBe(2_450_000);
    expect(p.tags).toEqual(["car", "vacuum"]);
    expect(p.shortDescription).toBeNull();
    expect(p.gift).toBeNull();
  });

  it("rejects bad prices, slugs and compare-at below price", () => {
    const r = productInput.safeParse({ ...base, slug: "Turbo Vacuum", price: "abc", compareAt: "100" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["slug", "price"]));
    const low = productInput.safeParse({ ...base, compareAt: "10,000" });
    expect(low.error!.issues[0]!.path).toEqual(["compareAt"]);
  });

  it("enforces honest bundle promos and label-only tags", () => {
    const bundle = { label: "2x Pack", quantity: 2, price: "45,000" };
    const ok = productInput.parse({ ...base, bundles: [{ ...bundle, promoPrice: "35,000", promoEndsAt: "2026-10-06T23:59", tag: "MOST POPULAR" }] });
    expect(ok.bundles[0]).toMatchObject({ price: 4_500_000, promoPrice: 3_500_000 });
    expect(ok.bundles[0]!.promoEndsAt!.toISOString()).toBe("2026-10-06T22:59:00.000Z");

    const noDeadline = productInput.safeParse({ ...base, bundles: [{ ...bundle, promoPrice: "35,000" }] });
    expect(noDeadline.error!.issues[0]!.message).toMatch(/real end date/);
    const higher = productInput.safeParse({ ...base, bundles: [{ ...bundle, promoPrice: "50,000", promoEndsAt: "2026-10-06T23:59" }] });
    expect(higher.error!.issues[0]!.message).toMatch(/lower than the regular price/);
    const typed = productInput.safeParse({ ...base, bundles: [{ ...bundle, tag: "SAVE EXTRA ₦4,000" }] });
    expect(typed.error!.issues[0]!.message).toMatch(/Labels only/);
    const twoPopular = productInput.safeParse({ ...base, bundles: [{ ...bundle, isPopular: true }, { ...bundle, label: "3x", isPopular: true }] });
    expect(twoPopular.error!.issues[0]!.message).toMatch(/Only one bundle/);
  });
});
