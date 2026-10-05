import { describe, expect, it } from "vitest";
import { autoLandingPage, type AutoLandingProduct } from "./landing-auto";

const base: AutoLandingProduct = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "bladeless-neck-fan",
  name: "Bladeless Hanging Neck Fan",
  shortDescription: "Personal breeze for hot afternoons.",
  seoTitle: null,
  seoDescription: null,
  warrantyMonths: 0,
  gift: null,
  promoEndsAt: null,
  features: [],
};

describe("autoLandingPage", () => {
  it("builds the page from the product only — no trend, timer, regions or video", () => {
    const lp = autoLandingPage(base);
    expect(lp).toMatchObject({ id: null, slug: base.slug, isPublished: true, headline: base.name, subheadline: base.shortDescription });
    expect([lp.trendBadge, lp.campaignEndsAt, lp.regionsText, lp.videoUrl, lp.heroOverlayText]).toEqual([null, null, null, null, null]);
    expect(lp.hookLabel).toBe("ORDER TODAY");
  });

  it("claims a warranty only when the product has one, with its real length", () => {
    expect(autoLandingPage(base).warrantyBadge).toBeNull();
    expect(autoLandingPage(base).sections[0]!.items.map((i) => i.icon)).not.toContain("verified_user");
    const lp = autoLandingPage({ ...base, warrantyMonths: 6 });
    expect(lp.warrantyBadge).toBe("6-Month Warranty");
    expect(lp.sections[0]!.items.at(-1)!.title).toBe("6-Month MUBAZZAR Warranty");
  });

  it("says PROMO only while a promo is live, and mentions a live free gift", () => {
    expect(autoLandingPage({ ...base, promoEndsAt: "2026-10-06T00:00:00Z" }).hookLabel).toBe("PROMO ALERT");
    const gift = autoLandingPage({ ...base, gift: { name: "Car Diffuser" } });
    expect(gift.hookLabel).toBe("FREE GIFT");
    expect(gift.hookBanner).toContain("Free Car Diffuser");
  });

  it("leaves out a trust point the product's features already show", () => {
    const lp = autoLandingPage({ ...base, features: [{ title: "Fast Nationwide Delivery " }] });
    expect(lp.sections[0]!.items.map((i) => i.title)).toEqual(["Pay On Delivery (Arrange in Chat)"]);
  });
});
